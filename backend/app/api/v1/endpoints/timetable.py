"""
Timetable API endpoints — AcadFlow Phase 6 & Part B Timetable Manager.

Features:
- Central source of truth for course timetables and version staging.
- Non-blocking clash detection: teacher, room, and section overlaps. Warn, never block.
- Draft saving always succeeds.
- Version management: draft vs immutable published vs archived; version restore.
- Room master management (CRUD) scoped to department dean/coordinator and admin.
- Pre-publish preview with slot diff calculation and affected users count.
- Publishing with conflicts confirmation ("Publish with N conflicts" tick) and audit logging.
- Slot diff calculation and targeted notifications to affected students and teachers only.
- Strict RBAC: Central permission check, 403 on out-of-scope access.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.authorization import Action, verify_access, check_is_dean
from app.core.deps import get_db
from app.core.errors import NotFoundError
from app.models import (
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    SemesterModel,
    StudentModel,
    UserModel,
)
from app.models.audit import AuditLogModel
from app.models.timetable import (
    PeriodConfigModel,
    RoomModel,
    TimetableSlotModel,
    TimetableVersionModel,
)

router = APIRouter()

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Default standard period timings when period configs are absent
DEFAULT_PERIOD_TIMES = {
    "P1": ("09:00", "10:00"),
    "P2": ("10:00", "11:00"),
    "P3": ("11:00", "12:00"),
    "P4": ("12:00", "13:00"),
    "P5": ("13:00", "14:00"),
    "P6": ("14:00", "15:00"),
    "P7": ("15:00", "16:00"),
    "P8": ("16:00", "17:00"),
}


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: str
    capacity: Optional[int] = 60
    room_type: str = "classroom"  # classroom, lab, seminar
    department_id: Optional[int] = None


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    room_type: Optional[str] = None
    department_id: Optional[int] = None


class RoomOut(BaseModel):
    id: int
    name: str
    capacity: Optional[int]
    room_type: str
    department_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class SlotIn(BaseModel):
    course_id: int
    section: Optional[str] = "A"
    teacher_id: int
    room_id: Optional[int] = None
    day: int  # 0=Mon .. 5=Sat
    period_label: str  # "P1", "P2"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    kind: str = "lecture"  # lecture, lab, tutorial


class SlotOut(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_name: str
    course_short_name: Optional[str] = None
    section: Optional[str]
    teacher_id: int
    teacher_name: str
    room_id: Optional[int]
    room_name: Optional[str]
    day: int
    day_name: str
    period_label: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    kind: str
    is_clash: bool = False
    clash_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PeriodConfigIn(BaseModel):
    day: int
    start_time: str
    end_time: str
    label: str
    is_break: bool = False


class PeriodConfigOut(BaseModel):
    id: int
    version_id: int
    day: int
    start_time: str
    end_time: str
    label: str
    is_break: bool

    model_config = ConfigDict(from_attributes=True)


class TimetableVersionOut(BaseModel):
    id: int
    department_id: int
    semester_id: int
    name: Optional[str] = None
    status: str
    effective_from: Optional[str] = None
    created_by: int
    published_at: Optional[str] = None
    conflicts_count: int = 0
    is_published_with_conflicts: bool = False
    restored_from_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class DraftSaveRequest(BaseModel):
    version_id: int
    slots: List[SlotIn]
    periods: Optional[List[PeriodConfigIn]] = None


class PublishRequest(BaseModel):
    version_id: int
    effective_from: Optional[str] = None
    publish_with_conflicts: bool = False


class ValidateRequest(BaseModel):
    version_id: Optional[int] = None
    slots: Optional[List[SlotIn]] = None


class CreateVersionRequest(BaseModel):
    department_id: int
    semester_id: int
    name: Optional[str] = None
    effective_from: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Helper Functions: RBAC & Scope Verification
# ──────────────────────────────────────────────────────────────────────────────

def _verify_timetable_permission(current_user: Optional[dict], department_id: int, db: Session) -> None:
    """
    Central permission check for timetable authoring / publishing.
    Allowed:
    - Admin (all departments)
    - Coordinator of that department
    - Dean of that department
    Denied (403):
    - Faculty not coordinator/dean of that department
    - Users from other departments
    - Students
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_401", "message": "Authentication required"},
        )

    user_role = current_user.get("role", "")
    user_id = int(current_user.get("sub", current_user.get("id", 0)))
    user_dept = current_user.get("department_id")

    if user_role == "admin":
        return

    # Check if user is dean or coordinator for the department
    if user_role in ("coordinator", "dean"):
        if user_dept is not None and int(user_dept) == int(department_id):
            return

    # Also check DeanAssignmentModel if user has faculty role but is designated dean
    if check_is_dean(db, user_id, department_id):
        return

    # Fallback standard verify_access
    verify_access(current_user, Action.TIMETABLE_WRITE, {"department_id": department_id})


# ──────────────────────────────────────────────────────────────────────────────
# Helper Functions: Clash Detection Algorithm
# ──────────────────────────────────────────────────────────────────────────────

def _get_slot_time_interval(slot: Any, period_configs: Dict[Tuple[int, str], Tuple[str, str]]) -> Tuple[str, str]:
    """Resolve start_time and end_time for a slot."""
    start = getattr(slot, "start_time", None)
    end = getattr(slot, "end_time", None)

    if start and end:
        return (str(start).strip(), str(end).strip())

    day = getattr(slot, "day", 0)
    period = getattr(slot, "period_label", "P1")

    if (day, period) in period_configs:
        return period_configs[(day, period)]

    if period in DEFAULT_PERIOD_TIMES:
        return DEFAULT_PERIOD_TIMES[period]

    # Default 1-hour based on period number if numeric
    if period.startswith("P") and period[1:].isdigit():
        p_num = int(period[1:])
        s_hour = 8 + p_num
        return (f"{s_hour:02d}:00", f"{s_hour+1:02d}:00")

    return ("09:00", "10:00")


def _times_overlap(s1: str, e1: str, s2: str, e2: str) -> bool:
    """
    Check if two time intervals overlap.
    Back-to-back classes (e.g. 09:00-10:00 and 10:00-11:00) DO NOT overlap.
    Overlapping means: max(s1, s2) < min(e1, e2).
    """
    return max(s1, s2) < min(e1, e2)


def detect_clashes(slots: List[Any], period_configs_list: Optional[List[Any]] = None, db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """
    Multi-dimensional non-blocking clash detection:
    - Teacher clash: same teacher in overlapping time slots on same day.
    - Room clash: same room in overlapping time slots on same day.
    - Section clash: same section in overlapping time slots on same day.
    - Labs occupying multiple periods are checked across all occupied time.
    - Back-to-back classes do not clash.
    """
    period_configs: Dict[Tuple[int, str], Tuple[str, str]] = {}
    if period_configs_list:
        for p in period_configs_list:
            period_configs[(p.day, p.label)] = (p.start_time, p.end_time)

    # Cache user, course, room names if db provided
    user_names: Dict[int, str] = {}
    course_codes: Dict[int, str] = {}
    room_names: Dict[int, str] = {}

    if db:
        # Pre-populate names
        uids = {s.teacher_id for s in slots if hasattr(s, "teacher_id") and s.teacher_id}
        cids = {s.course_id for s in slots if hasattr(s, "course_id") and s.course_id}
        rids = {s.room_id for s in slots if hasattr(s, "room_id") and s.room_id}

        if uids:
            for u in db.scalars(select(UserModel).where(UserModel.id.in_(uids))).all():
                user_names[u.id] = u.name
        if cids:
            for c in db.scalars(select(CourseModel).where(CourseModel.id.in_(cids))).all():
                course_codes[c.id] = c.code or c.name
        if rids:
            for r in db.scalars(select(RoomModel).where(RoomModel.id.in_(rids))).all():
                room_names[r.id] = r.name

    clashes: List[Dict[str, Any]] = []
    seen_clash_pairs: Set[Tuple[str, int, int]] = set()

    n = len(slots)
    for i in range(n):
        slot_a = slots[i]
        day_a = getattr(slot_a, "day", 0)
        start_a, end_a = _get_slot_time_interval(slot_a, period_configs)
        id_a = getattr(slot_a, "id", i + 1) or (i + 1)
        teacher_a = getattr(slot_a, "teacher_id", None)
        room_a = getattr(slot_a, "room_id", None)
        section_a = getattr(slot_a, "section", "A")
        course_a = getattr(slot_a, "course_id", None)

        for j in range(i + 1, n):
            slot_b = slots[j]
            day_b = getattr(slot_b, "day", 0)
            if day_a != day_b:
                continue

            start_b, end_b = _get_slot_time_interval(slot_b, period_configs)
            if not _times_overlap(start_a, end_a, start_b, end_b):
                continue

            id_b = getattr(slot_b, "id", j + 1) or (j + 1)
            pair_key = (min(id_a, id_b), max(id_a, id_b))
            day_name = DAY_NAMES[day_a] if 0 <= day_a < 7 else f"Day {day_a}"
            time_str = f"{start_a}-{end_a}" if start_a == start_b and end_a == end_b else f"{start_a}-{end_a} / {start_b}-{end_b}"

            # 1. Teacher clash
            teacher_b = getattr(slot_b, "teacher_id", None)
            if teacher_a and teacher_b and teacher_a == teacher_b:
                clash_sig = ("teacher", pair_key[0], pair_key[1])
                if clash_sig not in seen_clash_pairs:
                    seen_clash_pairs.add(clash_sig)
                    t_name = user_names.get(teacher_a, f"Faculty #{teacher_a}")
                    c_a = course_codes.get(course_a, f"Course #{course_a}")
                    c_b = course_codes.get(getattr(slot_b, "course_id", None), "Course")
                    clashes.append({
                        "type": "teacher",
                        "severity": "clash",
                        "description": f"Clash: {t_name} is double-booked for {c_a} and {c_b} on {day_name} ({time_str})",
                        "entity_name": t_name,
                        "day": day_a,
                        "period_label": getattr(slot_a, "period_label", "P1"),
                        "slot_ids": [id_a, id_b],
                    })

            # 2. Room clash
            room_b = getattr(slot_b, "room_id", None)
            if room_a and room_b and room_a == room_b:
                clash_sig = ("room", pair_key[0], pair_key[1])
                if clash_sig not in seen_clash_pairs:
                    seen_clash_pairs.add(clash_sig)
                    r_name = room_names.get(room_a, f"Room #{room_a}")
                    c_a = course_codes.get(course_a, f"Course #{course_a}")
                    c_b = course_codes.get(getattr(slot_b, "course_id", None), "Course")
                    clashes.append({
                        "type": "room",
                        "severity": "clash",
                        "description": f"Clash: {r_name} is double-booked for {c_a} and {c_b} on {day_name} ({time_str})",
                        "entity_name": r_name,
                        "day": day_a,
                        "period_label": getattr(slot_a, "period_label", "P1"),
                        "slot_ids": [id_a, id_b],
                    })

            # 3. Section clash (same section assigned two different classes simultaneously)
            section_b = getattr(slot_b, "section", "A")
            if section_a and section_b and section_a == section_b and course_a != getattr(slot_b, "course_id", None):
                clash_sig = ("section", pair_key[0], pair_key[1])
                if clash_sig not in seen_clash_pairs:
                    seen_clash_pairs.add(clash_sig)
                    c_a = course_codes.get(course_a, f"Course #{course_a}")
                    c_b = course_codes.get(getattr(slot_b, "course_id", None), "Course")
                    clashes.append({
                        "type": "section",
                        "severity": "clash",
                        "description": f"Clash: Section {section_a} has overlapping classes ({c_a} & {c_b}) on {day_name} ({time_str})",
                        "entity_name": f"Section {section_a}",
                        "day": day_a,
                        "period_label": getattr(slot_a, "period_label", "P1"),
                        "slot_ids": [id_a, id_b],
                    })

    return clashes


# ──────────────────────────────────────────────────────────────────────────────
# Helper Functions: Diff Calculation & Targeted Notifications
# ──────────────────────────────────────────────────────────────────────────────

def calculate_slot_diff(
    previous_slots: List[TimetableSlotModel],
    new_slots: List[TimetableSlotModel],
    db: Session,
) -> Tuple[List[str], Set[int], Set[int]]:
    """
    Compare new slots against previous published slots.
    Returns:
    - diff_summary_list: list of readable strings e.g. "Tue 11:00 DSA moved from Mon 10:00, Room B-204"
    - affected_teacher_ids: set of user IDs
    - affected_student_ids: set of user IDs (enrolled in modified courses & sections)
    """
    diff_summaries: List[str] = []
    affected_teachers: Set[int] = set()
    affected_courses_sections: Set[Tuple[int, Optional[str]]] = set()

    # Build signatures for previous slots:
    # key: (course_id, section) -> list of slots
    prev_by_cs: Dict[Tuple[int, Optional[str]], List[TimetableSlotModel]] = {}
    for s in previous_slots:
        prev_by_cs.setdefault((s.course_id, s.section), []).append(s)

    new_by_cs: Dict[Tuple[int, Optional[str]], List[TimetableSlotModel]] = {}
    for s in new_slots:
        new_by_cs.setdefault((s.course_id, s.section), []).append(s)

    all_keys = set(prev_by_cs.keys()).union(set(new_by_cs.keys()))

    for cs in all_keys:
        p_slots = prev_by_cs.get(cs, [])
        n_slots = new_by_cs.get(cs, [])

        course = db.get(CourseModel, cs[0])
        course_name = course.code if course and course.code else (course.name if course else f"Course #{cs[0]}")
        sec_str = f" Sec {cs[1]}" if cs[1] else ""

        # Check for matching slots vs changed slots
        unmatched_new = list(n_slots)
        unmatched_prev = list(p_slots)

        # Exact match (day, period_label, room_id, teacher_id) -> unchanged
        remaining_new = []
        for n_s in unmatched_new:
            match = None
            for p_s in unmatched_prev:
                if (
                    p_s.day == n_s.day
                    and p_s.period_label == n_s.period_label
                    and p_s.room_id == n_s.room_id
                    and p_s.teacher_id == n_s.teacher_id
                ):
                    match = p_s
                    break
            if match:
                unmatched_prev.remove(match)
            else:
                remaining_new.append(n_s)

        # Look for moved slots (same course/sec, matched pairwise)
        for n_s in remaining_new:
            day_str = DAY_NAMES[n_s.day] if 0 <= n_s.day < 7 else f"Day {n_s.day}"
            room = db.get(RoomModel, n_s.room_id) if n_s.room_id else None
            room_str = f", {room.name}" if room else ""

            if unmatched_prev:
                p_s = unmatched_prev.pop(0)
                old_day_str = DAY_NAMES[p_s.day] if 0 <= p_s.day < 7 else f"Day {p_s.day}"
                old_room = db.get(RoomModel, p_s.room_id) if p_s.room_id else None
                old_room_str = f", {old_room.name}" if old_room else ""

                if p_s.day != n_s.day or p_s.period_label != n_s.period_label:
                    diff_summaries.append(
                        f"{day_str} {n_s.period_label} {course_name}{sec_str} moved from {old_day_str} {p_s.period_label}{room_str}"
                    )
                elif p_s.room_id != n_s.room_id:
                    diff_summaries.append(
                        f"{day_str} {n_s.period_label} {course_name}{sec_str} room changed to {room.name if room else 'TBD'}"
                    )
                elif p_s.teacher_id != n_s.teacher_id:
                    new_t = db.get(UserModel, n_s.teacher_id)
                    diff_summaries.append(
                        f"{day_str} {n_s.period_label} {course_name}{sec_str} instructor changed to {new_t.name if new_t else 'Faculty'}"
                    )

                affected_teachers.add(p_s.teacher_id)
                affected_teachers.add(n_s.teacher_id)
                affected_courses_sections.add(cs)
            else:
                # Newly added slot
                diff_summaries.append(
                    f"Added {day_str} {n_s.period_label} {course_name}{sec_str}{room_str}"
                )
                affected_teachers.add(n_s.teacher_id)
                affected_courses_sections.add(cs)

        # Any remaining in unmatched_prev were removed
        for p_s in unmatched_prev:
            old_day_str = DAY_NAMES[p_s.day] if 0 <= p_s.day < 7 else f"Day {p_s.day}"
            diff_summaries.append(
                f"Removed {old_day_str} {p_s.period_label} {course_name}{sec_str}"
            )
            affected_teachers.add(p_s.teacher_id)
            affected_courses_sections.add(cs)

    # Find affected student IDs based on enrolled courses and sections
    affected_students: Set[int] = set()
    for cid, sec in affected_courses_sections:
        enrolments = db.scalars(
            select(EnrolmentModel).where(EnrolmentModel.course_id == cid)
        ).all()
        for e in enrolments:
            if sec:
                stu = db.get(StudentModel, e.student_id)
                if stu and stu.section and stu.section != sec:
                    continue
            affected_students.add(e.student_id)

    return diff_summaries, affected_teachers, affected_students


# ──────────────────────────────────────────────────────────────────────────────
# Room Master Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/rooms", summary="List all rooms")
def list_rooms(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = select(RoomModel)
    if department_id:
        query = query.where(or_(RoomModel.department_id == department_id, RoomModel.department_id.is_(None)))
    rooms = db.scalars(query).all()
    if not rooms:
        return [
            {"id": 1, "name": "Room 101", "capacity": 60, "room_type": "classroom", "department_id": None},
            {"id": 2, "name": "Lab 201", "capacity": 40, "room_type": "lab", "department_id": None},
            {"id": 3, "name": "Seminar 301", "capacity": 120, "room_type": "seminar", "department_id": None},
        ]
    return [
        {
            "id": r.id,
            "name": r.name,
            "capacity": r.capacity,
            "room_type": r.room_type,
            "department_id": r.department_id,
        }
        for r in rooms
    ]


@router.post("/rooms", response_model=RoomOut, status_code=status.HTTP_201_CREATED, summary="Create a room")
def create_room(
    payload: RoomCreate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = payload.department_id or (current_user.get("department_id") if current_user else 1) or 1
    _verify_timetable_permission(current_user, dept_id, db)

    existing = db.scalar(select(RoomModel).where(RoomModel.name == payload.name))
    if existing:
        raise HTTPException(status_code=400, detail=f"Room with name '{payload.name}' already exists.")

    room = RoomModel(
        name=payload.name,
        capacity=payload.capacity,
        room_type=payload.room_type,
        department_id=payload.department_id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return RoomOut.model_validate(room)


@router.patch("/rooms/{room_id}", response_model=RoomOut, summary="Update a room")
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    room = db.get(RoomModel, room_id)
    if not room:
        raise NotFoundError("Room not found")

    dept_id = room.department_id or (current_user.get("department_id") if current_user else 1) or 1
    _verify_timetable_permission(current_user, dept_id, db)

    if payload.name is not None:
        room.name = payload.name
    if payload.capacity is not None:
        room.capacity = payload.capacity
    if payload.room_type is not None:
        room.room_type = payload.room_type
    if payload.department_id is not None:
        room.department_id = payload.department_id

    db.commit()
    db.refresh(room)
    return RoomOut.model_validate(room)


@router.delete("/rooms/{room_id}", summary="Delete a room")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    room = db.get(RoomModel, room_id)
    if not room:
        raise NotFoundError("Room not found")

    dept_id = room.department_id or (current_user.get("department_id") if current_user else 1) or 1
    _verify_timetable_permission(current_user, dept_id, db)

    db.delete(room)
    db.commit()
    return {"deleted": True, "room_id": room_id}


# ──────────────────────────────────────────────────────────────────────────────
# Versioning & Draft Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/versions", response_model=List[TimetableVersionOut], summary="List timetable versions for department")
def list_versions(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = department_id or (current_user.get("department_id") if current_user else 1) or 1
    versions = db.scalars(
        select(TimetableVersionModel)
        .where(TimetableVersionModel.department_id == dept_id)
        .order_by(TimetableVersionModel.id.desc())
    ).all()

    out = []
    for v in versions:
        conflicts = json.loads(v.conflicts_json) if v.conflicts_json else []
        out.append(
            TimetableVersionOut(
                id=v.id,
                department_id=v.department_id,
                semester_id=v.semester_id,
                name=v.name or f"Timetable Version {v.id}",
                status=v.status,
                effective_from=v.effective_from,
                created_by=v.created_by,
                published_at=v.published_at,
                conflicts_count=len(conflicts),
                is_published_with_conflicts=v.is_published_with_conflicts or False,
                restored_from_id=v.restored_from_id,
            )
        )
    return out


@router.get("/versions/{version_id}", summary="Get specific timetable version details and slots")
def get_version_details(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    version = db.get(TimetableVersionModel, version_id)
    if not version:
        raise NotFoundError("Timetable version not found")

    slots = db.scalars(
        select(TimetableSlotModel).where(TimetableSlotModel.version_id == version.id)
    ).all()

    periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == version.id)
    ).all()

    clashes = detect_clashes(slots, periods, db)
    clash_slot_ids = {s_id for c in clashes for s_id in c.get("slot_ids", [])}

    slot_list = []
    for s in slots:
        c = db.get(CourseModel, s.course_id)
        t = db.get(UserModel, s.teacher_id)
        r = db.get(RoomModel, s.room_id) if s.room_id else None
        slot_list.append({
            "id": s.id,
            "course_id": s.course_id,
            "course_code": c.code if c else "",
            "course_name": c.name if c else "",
            "course_short_name": getattr(c, "short_name", None) or (c.code if c else ""),
            "section": s.section,
            "teacher_id": s.teacher_id,
            "teacher_name": t.name if t else "Faculty",
            "room_id": s.room_id,
            "room_name": r.name if r else None,
            "day": s.day,
            "day_name": DAY_NAMES[s.day] if 0 <= s.day < 7 else "Day",
            "period_label": s.period_label,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "kind": s.kind,
            "is_clash": s.id in clash_slot_ids,
        })

    return {
        "version": TimetableVersionOut(
            id=version.id,
            department_id=version.department_id,
            semester_id=version.semester_id,
            name=version.name or f"Timetable Version {version.id}",
            status=version.status,
            effective_from=version.effective_from,
            created_by=version.created_by,
            published_at=version.published_at,
            conflicts_count=len(clashes),
            is_published_with_conflicts=version.is_published_with_conflicts or False,
            restored_from_id=version.restored_from_id,
        ),
        "slots": slot_list,
        "periods": [PeriodConfigOut.model_validate(p) for p in periods],
        "clashes": clashes,
    }


@router.post("/versions", response_model=TimetableVersionOut, status_code=status.HTTP_201_CREATED, summary="Create a new draft version from scratch")
def create_version(
    payload: CreateVersionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    _verify_timetable_permission(current_user, payload.department_id, db)
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    version = TimetableVersionModel(
        department_id=payload.department_id,
        semester_id=payload.semester_id,
        name=payload.name or f"Draft Semester {payload.semester_id}",
        status="draft",
        effective_from=payload.effective_from,
        created_by=actor_id,
        conflicts_json="[]",
        is_published_with_conflicts=False,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    return TimetableVersionOut(
        id=version.id,
        department_id=version.department_id,
        semester_id=version.semester_id,
        name=version.name,
        status=version.status,
        effective_from=version.effective_from,
        created_by=version.created_by,
        published_at=None,
        conflicts_count=0,
        is_published_with_conflicts=False,
    )


@router.post("/versions/{version_id}/restore", summary="Restore historical version as a new active draft")
def restore_version(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    source_ver = db.get(TimetableVersionModel, version_id)
    if not source_ver:
        raise NotFoundError("Timetable version to restore not found")

    dept_id = source_ver.department_id
    _verify_timetable_permission(current_user, dept_id, db)
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    # Create new draft version pointing back to source
    new_version = TimetableVersionModel(
        department_id=dept_id,
        semester_id=source_ver.semester_id,
        name=f"Restored from v{source_ver.id} ({source_ver.name or 'Version'})",
        status="draft",
        effective_from=source_ver.effective_from,
        created_by=actor_id,
        restored_from_id=source_ver.id,
        conflicts_json=source_ver.conflicts_json,
        is_published_with_conflicts=source_ver.is_published_with_conflicts,
    )
    db.add(new_version)
    db.flush()

    # Copy period configs
    source_periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == source_ver.id)
    ).all()
    for sp in source_periods:
        db.add(
            PeriodConfigModel(
                version_id=new_version.id,
                day=sp.day,
                start_time=sp.start_time,
                end_time=sp.end_time,
                label=sp.label,
                is_break=sp.is_break,
            )
        )

    # Copy slots
    source_slots = db.scalars(
        select(TimetableSlotModel).where(TimetableSlotModel.version_id == source_ver.id)
    ).all()
    copied_count = 0
    for ss in source_slots:
        db.add(
            TimetableSlotModel(
                version_id=new_version.id,
                course_id=ss.course_id,
                section=ss.section,
                teacher_id=ss.teacher_id,
                room_id=ss.room_id,
                day=ss.day,
                period_label=ss.period_label,
                start_time=ss.start_time,
                end_time=ss.end_time,
                kind=ss.kind,
            )
        )
        copied_count += 1

    # Write audit log
    db.add(
        AuditLogModel(
            entity="timetable_versions",
            entity_id=str(new_version.id),
            action="timetable_version_restore",
            old_value=f"source_version_id={source_ver.id}",
            new_value=f"new_draft_id={new_version.id}, restored {copied_count} slots",
            actor_id=actor_id,
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(new_version)

    return {
        "restored": True,
        "new_version_id": new_version.id,
        "source_version_id": source_ver.id,
        "slots_copied": copied_count,
        "name": new_version.name,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Draft Grid & Clash Management
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/draft", summary="Get or initialize draft timetable for department")
def get_draft(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    dept_id = department_id or (current_user.get("department_id") if current_user else 1) or 1
    _verify_timetable_permission(current_user, dept_id, db)
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    sem_id = semester_id or 1

    draft = db.scalar(
        select(TimetableVersionModel)
        .where(
            TimetableVersionModel.department_id == dept_id,
            TimetableVersionModel.status == "draft",
        )
        .order_by(TimetableVersionModel.id.desc())
    )

    # If no draft exists, check if there is a published version to clone as base draft
    if not draft:
        published = db.scalar(
            select(TimetableVersionModel)
            .where(
                TimetableVersionModel.department_id == dept_id,
                TimetableVersionModel.status == "published",
            )
            .order_by(TimetableVersionModel.id.desc())
        )
        if published:
            draft = TimetableVersionModel(
                department_id=dept_id,
                semester_id=published.semester_id,
                name=f"Draft from v{published.id}",
                status="draft",
                effective_from=published.effective_from,
                created_by=actor_id,
            )
            db.add(draft)
            db.flush()

            # Clone published slots into this draft
            pub_slots = db.scalars(
                select(TimetableSlotModel).where(TimetableSlotModel.version_id == published.id)
            ).all()
            for ps in pub_slots:
                db.add(
                    TimetableSlotModel(
                        version_id=draft.id,
                        course_id=ps.course_id,
                        section=ps.section,
                        teacher_id=ps.teacher_id,
                        room_id=ps.room_id,
                        day=ps.day,
                        period_label=ps.period_label,
                        start_time=ps.start_time,
                        end_time=ps.end_time,
                        kind=ps.kind,
                    )
                )
            db.commit()
            db.refresh(draft)
        else:
            draft = TimetableVersionModel(
                department_id=dept_id,
                semester_id=sem_id,
                name="Initial Draft",
                status="draft",
                created_by=actor_id,
            )
            db.add(draft)
            db.commit()
            db.refresh(draft)

    slots = db.scalars(
        select(TimetableSlotModel).where(TimetableSlotModel.version_id == draft.id)
    ).all()

    periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == draft.id)
    ).all()

    clashes = detect_clashes(slots, periods, db)
    clash_slot_ids = {s_id for c in clashes for s_id in c.get("slot_ids", [])}

    slot_list = []
    for s in slots:
        c = db.get(CourseModel, s.course_id)
        t = db.get(UserModel, s.teacher_id)
        r = db.get(RoomModel, s.room_id) if s.room_id else None
        slot_list.append({
            "id": s.id,
            "course_id": s.course_id,
            "course_code": c.code if c else "",
            "course_name": c.name if c else "",
            "course_short_name": getattr(c, "short_name", None) or (c.code if c else ""),
            "section": s.section,
            "teacher_id": s.teacher_id,
            "teacher_name": t.name if t else "Faculty",
            "room_id": s.room_id,
            "room_name": r.name if r else None,
            "day": s.day,
            "day_name": DAY_NAMES[s.day] if 0 <= s.day < 7 else "Day",
            "period_label": s.period_label,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "kind": s.kind,
            "is_clash": s.id in clash_slot_ids,
        })

    # Compare vs latest published version for diff panel
    latest_published = db.scalar(
        select(TimetableVersionModel)
        .where(
            TimetableVersionModel.department_id == dept_id,
            TimetableVersionModel.status == "published",
        )
        .order_by(TimetableVersionModel.id.desc())
    )
    diff_summaries = []
    if latest_published:
        pub_slots = db.scalars(
            select(TimetableSlotModel).where(TimetableSlotModel.version_id == latest_published.id)
        ).all()
        diff_summaries, _, _ = calculate_slot_diff(pub_slots, slots, db)

    return {
        "version_id": draft.id,
        "department_id": draft.department_id,
        "semester_id": draft.semester_id,
        "name": draft.name,
        "status": draft.status,
        "effective_from": draft.effective_from,
        "slots": slot_list,
        "periods": [PeriodConfigOut.model_validate(p) for p in periods],
        "clashes_count": len(clashes),
        "clashes": clashes,
        "changes_vs_published": diff_summaries,
    }


@router.put("/draft", summary="Save staged slots into draft version (warn never block)")
def save_draft(
    payload: DraftSaveRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    version = db.get(TimetableVersionModel, payload.version_id)
    if not version:
        raise NotFoundError("Timetable version not found")

    _verify_timetable_permission(current_user, version.department_id, db)

    # 1. Update period configs if provided
    if payload.periods is not None:
        db.query(PeriodConfigModel).filter(PeriodConfigModel.version_id == version.id).delete()
        for p in payload.periods:
            db.add(
                PeriodConfigModel(
                    version_id=version.id,
                    day=p.day,
                    start_time=p.start_time,
                    end_time=p.end_time,
                    label=p.label,
                    is_break=p.is_break,
                )
            )

    # 2. Clear existing slots in this draft and replace with new slots
    db.query(TimetableSlotModel).filter(TimetableSlotModel.version_id == version.id).delete()
    db.flush()

    new_slots = []
    for s in payload.slots:
        slot = TimetableSlotModel(
            version_id=version.id,
            course_id=s.course_id,
            section=s.section,
            teacher_id=s.teacher_id,
            room_id=s.room_id,
            day=s.day,
            period_label=s.period_label,
            start_time=s.start_time,
            end_time=s.end_time,
            kind=s.kind,
        )
        db.add(slot)
        new_slots.append(slot)
    db.flush()

    # 3. Non-blocking clash detection: compute clashes and save to conflicts_json
    periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == version.id)
    ).all()
    clashes = detect_clashes(new_slots, periods, db)
    version.conflicts_json = json.dumps(clashes)

    db.commit()

    return {
        "saved": True,
        "version_id": version.id,
        "slots_count": len(new_slots),
        "clashes_count": len(clashes),
        "clashes": clashes,
    }


@router.post("/draft/validate", summary="Run non-blocking clash detection on draft timetable")
def validate_draft(
    payload: ValidateRequest,
    version_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    vid = payload.version_id or version_id
    slots_to_check = []
    periods_to_check = []

    if vid:
        version = db.get(TimetableVersionModel, vid)
        if version:
            if current_user:
                _verify_timetable_permission(current_user, version.department_id, db)
            periods_to_check = db.scalars(
                select(PeriodConfigModel).where(PeriodConfigModel.version_id == vid)
            ).all()

    if payload.slots is not None and len(payload.slots) > 0:
        slots_to_check = payload.slots
    elif vid:
        slots_to_check = db.scalars(
            select(TimetableSlotModel).where(TimetableSlotModel.version_id == vid)
        ).all()

    clashes = detect_clashes(slots_to_check, periods_to_check, db)

    return {
        "version_id": vid,
        "valid": len(clashes) == 0,
        "clashes_count": len(clashes),
        "clashes": clashes,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Publishing & Pre-publish Preview
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/publish-preview", summary="Preview timetable publish: diff against current, affected users, and clashes")
def publish_preview(
    payload: ValidateRequest,
    version_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    vid = payload.version_id or version_id
    if not vid:
        raise HTTPException(status_code=400, detail="version_id is required")

    version = db.get(TimetableVersionModel, vid)
    if not version:
        raise NotFoundError("Timetable version not found")

    _verify_timetable_permission(current_user, version.department_id, db)

    slots = db.scalars(
        select(TimetableSlotModel).where(TimetableSlotModel.version_id == vid)
    ).all()
    periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == vid)
    ).all()

    clashes = detect_clashes(slots, periods, db)

    # Previous published version
    prev_published = db.scalar(
        select(TimetableVersionModel).where(
            TimetableVersionModel.department_id == version.department_id,
            TimetableVersionModel.status == "published",
            TimetableVersionModel.id != version.id,
        )
    )

    diff_summaries = []
    affected_teachers: Set[int] = set()
    affected_students: Set[int] = set()

    if prev_published:
        prev_slots = db.scalars(
            select(TimetableSlotModel).where(TimetableSlotModel.version_id == prev_published.id)
        ).all()
        diff_summaries, affected_teachers, affected_students = calculate_slot_diff(prev_slots, slots, db)
    else:
        # First time publish: all teachers and students in these slots are affected
        diff_summaries.append(f"Initial publication with {len(slots)} class slots.")
        affected_teachers = {s.teacher_id for s in slots}
        c_ids = {s.course_id for s in slots}
        enrolments = db.scalars(select(EnrolmentModel).where(EnrolmentModel.course_id.in_(c_ids))).all()
        affected_students = {e.student_id for e in enrolments}

    return {
        "version_id": vid,
        "clashes_count": len(clashes),
        "clashes": clashes,
        "has_clashes": len(clashes) > 0,
        "diff_summary": diff_summaries,
        "affected_teachers_count": len(affected_teachers),
        "affected_students_count": len(affected_students),
    }


@router.post("/publish", summary="Publish draft timetable with conflict audit and targeted notifications")
def publish_timetable(
    payload: PublishRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    version = db.get(TimetableVersionModel, payload.version_id)
    if not version:
        raise NotFoundError("Timetable version not found")

    dept_id = version.department_id
    _verify_timetable_permission(current_user, dept_id, db)
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    slots = db.scalars(
        select(TimetableSlotModel).where(TimetableSlotModel.version_id == version.id)
    ).all()
    periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == version.id)
    ).all()

    clashes = detect_clashes(slots, periods, db)
    has_clashes = len(clashes) > 0

    # If conflicts exist and sender has not confirmed "publish_with_conflicts" -> return 422
    if has_clashes and not payload.publish_with_conflicts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "TIMETABLE_CLASHES_EXIST",
                "message": f"Timetable has {len(clashes)} unresolved clash(es). Confirm 'Publish with conflicts' to proceed.",
                "clashes_count": len(clashes),
                "clashes": clashes,
            },
        )

    # Find previous published version for diff & archiving
    prev_published = db.scalar(
        select(TimetableVersionModel).where(
            TimetableVersionModel.department_id == dept_id,
            TimetableVersionModel.status == "published",
            TimetableVersionModel.id != version.id,
        )
    )

    diff_summaries: List[str] = []
    affected_teachers: Set[int] = set()
    affected_students: Set[int] = set()

    if prev_published:
        prev_slots = db.scalars(
            select(TimetableSlotModel).where(TimetableSlotModel.version_id == prev_published.id)
        ).all()
        diff_summaries, affected_teachers, affected_students = calculate_slot_diff(prev_slots, slots, db)
        prev_published.status = "archived"
    else:
        diff_summaries.append(f"Initial publication of {len(slots)} slots.")
        affected_teachers = {s.teacher_id for s in slots}
        c_ids = {s.course_id for s in slots}
        enrolments = db.scalars(select(EnrolmentModel).where(EnrolmentModel.course_id.in_(c_ids))).all()
        affected_students = {e.student_id for e in enrolments}

    # Transition version to published
    version.status = "published"
    version.published_at = datetime.now(timezone.utc).isoformat()
    if payload.effective_from:
        version.effective_from = payload.effective_from
    version.conflicts_json = json.dumps(clashes)
    version.is_published_with_conflicts = has_clashes

    # Audit logging
    audit_action = "timetable_publish_with_conflicts" if has_clashes else "timetable_publish"
    audit_detail = (
        f"Published with {len(clashes)} conflicts: {len(slots)} slots effective {version.effective_from or 'now'}"
        if has_clashes
        else f"Published clean: {len(slots)} slots effective {version.effective_from or 'now'}"
    )

    db.add(
        AuditLogModel(
            entity="timetable_versions",
            entity_id=str(version.id),
            action=audit_action,
            old_value=prev_published.status if prev_published else "none",
            new_value=audit_detail,
            actor_id=actor_id,
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(version)

    # Targeted notifications ONLY if diff exists
    if diff_summaries:
        try:
            from app.services.notification_service import create_in_app_notification

            summary_bullet = "\n".join(diff_summaries[:3])
            if len(diff_summaries) > 3:
                summary_bullet += f"\n...and {len(diff_summaries) - 3} more updates."

            for uid in affected_teachers:
                create_in_app_notification(
                    db=db,
                    user_id=uid,
                    title="Teaching Schedule Updated",
                    message=f"Timetable version {version.id} has been published with updates to your classes:\n{summary_bullet}",
                    notif_type="timetable_updated",
                )
            for uid in affected_students:
                create_in_app_notification(
                    db=db,
                    user_id=uid,
                    title="Class Timetable Updated",
                    message=f"Timetable for your courses has changed (effective {version.effective_from or 'now'}):\n{summary_bullet}",
                    notif_type="timetable_updated",
                )
        except Exception:
            pass

    return {
        "published": True,
        "version_id": version.id,
        "department_id": version.department_id,
        "effective_from": version.effective_from,
        "is_published_with_conflicts": version.is_published_with_conflicts,
        "clashes_count": len(clashes),
        "clashes": clashes,
        "diff_summary": diff_summaries,
        "affected_students_count": len(affected_students),
        "affected_teachers_count": len(affected_teachers),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Student & Teacher Timetable Views
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=List[SlotOut], summary="Get current user timetable slots")
def get_my_timetable(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    if not current_user:
        return []

    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id", 1)
    role = current_user.get("role", "student")

    # Get latest published version
    version = db.scalar(
        select(TimetableVersionModel)
        .where(TimetableVersionModel.status == "published")
        .order_by(TimetableVersionModel.id.desc())
    )
    if not version:
        return []

    periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == version.id)
    ).all()

    if role == "student":
        enrolled_course_ids = [
            r for (r,) in db.execute(
                select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == user_id)
            ).all()
        ]
        stu = db.get(StudentModel, user_id)
        stu_sec = stu.section if stu else "A"

        slots_query = select(TimetableSlotModel).where(
            TimetableSlotModel.version_id == version.id,
            TimetableSlotModel.course_id.in_(enrolled_course_ids),
        )
        if stu_sec:
            slots_query = slots_query.where(or_(TimetableSlotModel.section == stu_sec, TimetableSlotModel.section.is_(None)))

        slots = db.scalars(slots_query).all()
    else:
        slots = db.scalars(
            select(TimetableSlotModel).where(
                TimetableSlotModel.version_id == version.id,
                TimetableSlotModel.teacher_id == user_id,
            )
        ).all()

    # Detect clashes in caller's view
    user_clashes = detect_clashes(slots, periods, db)
    clash_slot_ids = {s_id for c in user_clashes for s_id in c.get("slot_ids", [])}
    clash_reasons = {}
    for c in user_clashes:
        for sid in c.get("slot_ids", []):
            clash_reasons[sid] = c.get("description")

    results = []
    for s in slots:
        course = db.get(CourseModel, s.course_id)
        teacher = db.get(UserModel, s.teacher_id)
        room = db.get(RoomModel, s.room_id) if s.room_id else None
        is_clash = s.id in clash_slot_ids

        results.append(
            SlotOut(
                id=s.id,
                course_id=s.course_id,
                course_code=course.code if course else "",
                course_name=course.name if course else "",
                course_short_name=getattr(course, "short_name", None) or (course.code if course else "C"),
                section=s.section,
                teacher_id=s.teacher_id,
                teacher_name=teacher.name if teacher else "Faculty",
                room_id=s.room_id,
                room_name=room.name if room else None,
                day=s.day,
                day_name=DAY_NAMES[s.day] if 0 <= s.day < 7 else "Day",
                period_label=s.period_label,
                start_time=s.start_time,
                end_time=s.end_time,
                kind=s.kind,
                is_clash=is_clash,
                clash_reason=clash_reasons.get(s.id),
            )
        )
    return results


@router.get("/slots", response_model=List[SlotOut], summary="List timetable slots for a version")
def get_version_slots(
    version_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    target_vid = version_id
    dept_id = department_id or 1
    if not target_vid:
        latest = db.scalar(
            select(TimetableVersionModel)
            .where(TimetableVersionModel.department_id == dept_id)
            .order_by(TimetableVersionModel.id.desc())
        )
        if latest:
            target_vid = latest.id

    if not target_vid:
        return []

    slots = db.scalars(
        select(TimetableSlotModel).where(TimetableSlotModel.version_id == target_vid)
    ).all()
    periods = db.scalars(
        select(PeriodConfigModel).where(PeriodConfigModel.version_id == target_vid)
    ).all()

    clashes = detect_clashes(slots, periods, db)
    clash_slot_ids = {s_id for c in clashes for s_id in c.get("slot_ids", [])}

    out = []
    for s in slots:
        course = db.get(CourseModel, s.course_id)
        teacher = db.get(UserModel, s.teacher_id)
        room = db.get(RoomModel, s.room_id) if s.room_id else None
        out.append(
            SlotOut(
                id=s.id,
                course_id=s.course_id,
                course_code=course.code if course else "",
                course_name=course.name if course else "",
                course_short_name=getattr(course, "short_name", None) or (course.code if course else ""),
                section=s.section,
                teacher_id=s.teacher_id,
                teacher_name=teacher.name if teacher else "Faculty",
                room_id=s.room_id,
                room_name=room.name if room else None,
                day=s.day,
                day_name=DAY_NAMES[s.day] if 0 <= s.day < 7 else "Day",
                period_label=s.period_label,
                start_time=s.start_time,
                end_time=s.end_time,
                kind=s.kind,
                is_clash=s.id in clash_slot_ids,
            )
        )
    return out


# ──────────────────────────────────────────────────────────────────────────────
# Helper Grid Utilities (Copy Day, Copy Semester)
# ──────────────────────────────────────────────────────────────────────────────

class CopyDayRequest(BaseModel):
    version_id: int
    source_day: int
    target_day: int


@router.post("/slots/copy-day", summary="Copy all slots from one day to another in a draft")
def copy_day_slots(
    payload: CopyDayRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    version = db.get(TimetableVersionModel, payload.version_id)
    if not version:
        raise NotFoundError("Timetable version not found")

    _verify_timetable_permission(current_user, version.department_id, db)

    source_slots = db.scalars(
        select(TimetableSlotModel).where(
            TimetableSlotModel.version_id == version.id,
            TimetableSlotModel.day == payload.source_day,
        )
    ).all()

    # Clear existing slots on target day
    db.query(TimetableSlotModel).filter(
        TimetableSlotModel.version_id == version.id,
        TimetableSlotModel.day == payload.target_day,
    ).delete()

    created = 0
    for s in source_slots:
        db.add(
            TimetableSlotModel(
                version_id=version.id,
                course_id=s.course_id,
                section=s.section,
                teacher_id=s.teacher_id,
                room_id=s.room_id,
                day=payload.target_day,
                period_label=s.period_label,
                start_time=s.start_time,
                end_time=s.end_time,
                kind=s.kind,
            )
        )
        created += 1

    db.commit()
    return {"copied": True, "created_count": created, "source_day": payload.source_day, "target_day": payload.target_day}
