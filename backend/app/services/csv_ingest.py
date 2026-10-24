"""
CSV / Excel Attendance Ingest Service — AcadFlow

Faculty can upload an attendance spreadsheet (CSV or XLSX) for a course.
The file must contain columns: roll_no, date, status

Additional optional columns: remarks

Rules:
- Date formats accepted: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY
- Status values (case-insensitive): present/P, absent/A, late/L
- Duplicate entries (student+date already recorded) are skipped (idempotent)
- Unknown roll_no rows are collected in the error list
- Missing required columns → ValidationError raised immediately
- Returns an IngestResult with full audit trail

Supported file types:
- .csv (UTF-8 or UTF-8-BOM)
- .xlsx (Excel 2007+)
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import IO, List, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    StudentModel,
)

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_COLUMNS = {"roll_no", "date", "status"}

STATUS_MAP = {
    "present": "present", "p": "present",
    "absent": "absent", "a": "absent",
    "late": "late", "l": "late",
}

DATE_FORMATS = [
    "%Y-%m-%d",   # ISO: 2026-10-21
    "%d/%m/%Y",   # Indian: 21/10/2026
    "%d-%m-%Y",   # Indian dashes: 21-10-2026
    "%m/%d/%Y",   # US: 10/21/2026
    "%d %b %Y",   # 21 Oct 2026
    "%d %B %Y",   # 21 October 2026
]


# ─────────────────────────────────────────────────────────────────────────────
# Result schema
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class RowError:
    row_number: int
    roll_no: str
    date_str: str
    status_str: str
    reason: str


@dataclass
class IngestResult:
    course_id: int
    total_rows: int
    processed: int           # Successfully written to DB
    skipped_duplicates: int  # Already existed
    errors: List[RowError]   # Rows that could not be processed
    sessions_created: int    # New ClassSession rows created
    diffs: List[dict] = field(default_factory=list)
    dry_run: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Date parsing helper
# ─────────────────────────────────────────────────────────────────────────────


def _parse_date(raw: str) -> Optional[date]:
    """Try multiple date formats and return a date object or None."""
    raw = raw.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _normalize_status(raw: str) -> Optional[str]:
    """Normalize raw status string to one of: present / absent / late."""
    return STATUS_MAP.get(raw.strip().lower())


# ─────────────────────────────────────────────────────────────────────────────
# CSV parsing
# ─────────────────────────────────────────────────────────────────────────────


def _read_csv_rows(file_bytes: bytes) -> list[dict]:
    """Parse CSV bytes into list of dicts (header row → keys)."""
    # Strip UTF-8-BOM if present
    text = file_bytes.decode("utf-8-sig").strip()
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        # Normalize keys to lowercase and strip whitespace
        rows.append({k.strip().lower(): v.strip() for k, v in row.items()})
    return rows


def _read_xlsx_rows(file_bytes: bytes) -> list[dict]:
    """Parse XLSX bytes into list of dicts."""
    try:
        import openpyxl
    except ImportError as exc:
        raise ImportError(
            "openpyxl is required for Excel upload. "
            "Add 'openpyxl>=3.1.0' to requirements.txt."
        ) from exc

    wb = openpyxl.load_workbook(filename=io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    header_row = next(rows_iter, None)
    if not header_row:
        return []

    headers = [str(h).strip().lower() if h is not None else "" for h in header_row]
    rows = []
    for raw_row in rows_iter:
        if all(cell is None for cell in raw_row):
            continue  # skip empty rows
        row_dict = {}
        for h, val in zip(headers, raw_row):
            row_dict[h] = str(val).strip() if val is not None else ""
        rows.append(row_dict)
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Main ingest function
# ─────────────────────────────────────────────────────────────────────────────


def ingest_attendance_file(
    db: Session,
    file_bytes: bytes,
    filename: str,
    course_id: int,
    marked_by_user_id: int,
    dry_run: bool = False,
    change_reason: Optional[str] = None,
) -> IngestResult:
    """
    Parse an uploaded CSV/XLSX attendance file and write records to the database.

    Parameters
    ----------
    db                : active SQLAlchemy session
    file_bytes        : raw file content
    filename          : original filename (used to determine format)
    course_id         : FK → courses.id
    marked_by_user_id : the faculty/coordinator performing the upload

    Returns
    -------
    IngestResult with counts and error details

    Raises
    ------
    ValueError  on missing required columns or unrecognized file format
    """
    # ── Validate course ────────────────────────────────────────────────────
    course = db.get(CourseModel, course_id)
    if not course:
        raise ValueError(f"Course {course_id} not found.")

    # ── Parse file ─────────────────────────────────────────────────────────
    fname_lower = filename.lower()
    if fname_lower.endswith(".csv"):
        rows = _read_csv_rows(file_bytes)
    elif fname_lower.endswith((".xlsx", ".xls")):
        rows = _read_xlsx_rows(file_bytes)
    else:
        raise ValueError(
            f"Unsupported file format: '{filename}'. "
            "Please upload a .csv or .xlsx file."
        )

    if not rows:
        return IngestResult(
            course_id=course_id,
            total_rows=0,
            processed=0,
            skipped_duplicates=0,
            errors=[],
            sessions_created=0,
        )

    # ── Validate required columns ─────────────────────────────────────────
    found_cols = set(rows[0].keys())
    missing = REQUIRED_COLUMNS - found_cols
    if missing:
        raise ValueError(
            f"File is missing required column(s): {', '.join(sorted(missing))}. "
            f"Expected columns: {', '.join(sorted(REQUIRED_COLUMNS))}."
        )

    # ── Build roll_no → student_id lookup ────────────────────────────────
    all_students = db.scalars(select(StudentModel)).all()
    roll_to_student: dict[str, int] = {s.roll_no: s.user_id for s in all_students}

    # ── Cache class sessions (date → session_id) for this course ──────────
    existing_sessions = db.scalars(
        select(ClassSessionModel).where(
            ClassSessionModel.course_id == course_id,
        )
    ).all()
    session_date_map: dict[date, int] = {s.held_on: s.id for s in existing_sessions}

    # ── Process rows ───────────────────────────────────────────────────────
    result = IngestResult(
        course_id=course_id,
        total_rows=len(rows),
        processed=0,
        skipped_duplicates=0,
        errors=[],
        sessions_created=0,
    )

    now_utc = datetime.now(timezone.utc)

    for row_idx, row in enumerate(rows, start=2):  # start=2: row 1 is header
        roll_no = row.get("roll_no", "").strip()
        date_str = row.get("date", "").strip()
        status_str = row.get("status", "").strip()

        # ── Validate roll_no ───────────────────────────────────────────────
        student_id = roll_to_student.get(roll_no)
        if student_id is None:
            result.errors.append(
                RowError(
                    row_number=row_idx,
                    roll_no=roll_no,
                    date_str=date_str,
                    status_str=status_str,
                    reason=f"Roll number '{roll_no}' not found in the system.",
                )
            )
            continue

        # ── Parse date ─────────────────────────────────────────────────────
        parsed_date = _parse_date(date_str)
        if parsed_date is None:
            result.errors.append(
                RowError(
                    row_number=row_idx,
                    roll_no=roll_no,
                    date_str=date_str,
                    status_str=status_str,
                    reason=f"Cannot parse date '{date_str}'. "
                    "Accepted formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY.",
                )
            )
            continue

        # ── Normalize status ───────────────────────────────────────────────
        normalized_status = _normalize_status(status_str)
        if normalized_status is None:
            result.errors.append(
                RowError(
                    row_number=row_idx,
                    roll_no=roll_no,
                    date_str=date_str,
                    status_str=status_str,
                    reason=f"Invalid status '{status_str}'. "
                    "Valid values: present (P), absent (A), late (L).",
                )
            )
            continue

        # ── Get or create ClassSession for this date ──────────────────────
        if parsed_date not in session_date_map:
            new_session = ClassSessionModel(
                course_id=course_id,
                held_on=parsed_date,
                is_cancelled=False,
            )
            db.add(new_session)
            try:
                db.flush()
                session_date_map[parsed_date] = new_session.id
                result.sessions_created += 1
            except IntegrityError:
                db.rollback()
                # Reload — another request may have created it concurrently
                existing = db.scalar(
                    select(ClassSessionModel).where(
                        ClassSessionModel.course_id == course_id,
                        ClassSessionModel.held_on == parsed_date,
                    )
                )
                if existing:
                    session_date_map[parsed_date] = existing.id
                else:
                    result.errors.append(
                        RowError(
                            row_number=row_idx,
                            roll_no=roll_no,
                            date_str=date_str,
                            status_str=status_str,
                            reason="Failed to create class session (concurrency conflict).",
                        )
                    )
                    continue

        if dry_run:
            if parsed_date not in session_date_map:
                result.sessions_created += 1
                session_date_map[parsed_date] = -1
            session_id = session_date_map[parsed_date]
            existing_record = db.scalar(
                select(AttendanceRecordModel).where(
                    AttendanceRecordModel.student_id == student_id,
                    AttendanceRecordModel.session_id == session_id,
                )
            ) if session_id != -1 else None
            if existing_record and existing_record.status != normalized_status:
                result.diffs.append({
                    'roll_no': roll_no,
                    'date': str(parsed_date),
                    'old_status': existing_record.status,
                    'new_status': normalized_status,
                })
                result.skipped_duplicates += 1
            result.processed += 1
            continue

        session_id = session_date_map[parsed_date]

        # ── Check for duplicate attendance record ─────────────────────────
        existing_record = db.scalar(
            select(AttendanceRecordModel).where(
                AttendanceRecordModel.student_id == student_id,
                AttendanceRecordModel.session_id == session_id,
            )
        )
        if existing_record:
            # Update existing record (teacher is correcting it)
            existing_record.status = normalized_status
            existing_record.marked_by = marked_by_user_id
            existing_record.marked_at = now_utc
            result.skipped_duplicates += 1
            result.processed += 1
            continue

        # ── Write attendance record ────────────────────────────────────────
        new_record = AttendanceRecordModel(
            student_id=student_id,
            session_id=session_id,
            status=normalized_status,
            marked_by=marked_by_user_id,
            marked_at=now_utc,
        )
        db.add(new_record)
        try:
            db.flush()
            result.processed += 1
        except IntegrityError:
            db.rollback()
            result.skipped_duplicates += 1

    from app.models.audit import AuditLogModel
    if not dry_run:
        try:
            db.add(AuditLogModel(
                entity="attendance",
                entity_id=f"course:{course_id}",
                action="upload_attendance",
                old_value=None,
                new_value=f"{result.processed} processed, {result.sessions_created} sessions",
                actor_id=marked_by_user_id,
                reason=change_reason or "Attendance sheet upload",
                created_at=now_utc,
            ))
            db.commit()
        except Exception:
            db.commit()
    result.dry_run = dry_run
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Template generator (for teachers to download a pre-formatted sheet)
# ─────────────────────────────────────────────────────────────────────────────


def generate_attendance_template_csv(
    db: Session,
    course_id: int,
    session_date: Optional[date] = None,
) -> bytes:
    """
    Generate a pre-populated CSV template for attendance upload.
    Includes all enrolled students' roll numbers and optional date pre-fill.
    """
    from app.models import EnrolmentModel, UserModel

    # Get enrolled students with roll numbers and names
    rows = db.execute(
        select(StudentModel.roll_no, UserModel.name).join(
            EnrolmentModel, EnrolmentModel.student_id == StudentModel.user_id
        ).join(
            UserModel, UserModel.id == StudentModel.user_id
        ).where(
            EnrolmentModel.course_id == course_id
        ).order_by(StudentModel.roll_no)
    ).all()

    date_str = session_date.isoformat() if session_date else date.today().isoformat()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["roll_no", "student_name", "date", "status", "remarks"])
    for roll_no, name in rows:
        writer.writerow([roll_no, name, date_str, "present", ""])

    return output.getvalue().encode("utf-8-sig")  # UTF-8 BOM for Excel compatibility
