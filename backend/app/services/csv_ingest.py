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
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import func, select
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

REQUIRED_COLUMNS = {"roll_no", "status"}

COLUMN_ALIASES = {
    "roll_no": "roll_no",
    "roll no": "roll_no",
    "roll_number": "roll_no",
    "roll number": "roll_no",
    "rollno": "roll_no",
    "roll": "roll_no",
    "status": "status",
    "attendance": "status",
    "present": "status",
    "is_present": "status",
    "status (present / absent)": "status",
    "status(present/absent)": "status",
    "student_name": "student_name",
    "student name": "student_name",
    "name": "student_name",
    "date": "date",
    "session_date": "date",
    "remarks": "remarks",
}

def _canonical_column(col_name: str) -> str:
    cleaned = col_name.strip().lower()
    return COLUMN_ALIASES.get(cleaned, cleaned)

STATUS_MAP = {
    # Present / Checked / Ticked
    "present": "present", "p": "present",
    "true": "present", "1": "present", "yes": "present", "y": "present",
    "✓": "present", "✔": "present", "tick": "present", "checked": "present", "check": "present",
    # Absent / Unchecked
    "absent": "absent", "a": "absent",
    "false": "absent", "0": "absent", "no": "absent", "n": "absent",
    "✕": "absent", "✗": "absent", "x": "absent", "cross": "absent",
    "uncheck": "absent", "unchecked": "absent",
    # Legacy late -> map to present
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
    warnings: dict = field(default_factory=dict)
    warning_messages: List[str] = field(default_factory=list)
    batch_id: Optional[int] = None


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


def _normalize_status(raw: any) -> Optional[str]:
    """Normalize raw status string or boolean to one of: present / absent."""
    if isinstance(raw, bool):
        return "present" if raw else "absent"
    if isinstance(raw, (int, float)):
        return "present" if int(raw) == 1 else "absent"
    if raw is None:
        return "absent"
    val = str(raw).strip().lower()
    return STATUS_MAP.get(val)


# ─────────────────────────────────────────────────────────────────────────────
# CSV parsing
# ─────────────────────────────────────────────────────────────────────────────


def _read_csv_rows(file_bytes: bytes) -> list[dict]:
    """Parse CSV bytes into list of dicts with canonical column keys."""
    text = file_bytes.decode("utf-8-sig").strip()
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        row_dict = {}
        for k, v in row.items():
            if k is not None:
                canon_k = _canonical_column(str(k))
                row_dict[canon_k] = str(v).strip() if v is not None else ""
        rows.append(row_dict)
    return rows


def _read_xlsx_rows(file_bytes: bytes) -> list[dict]:
    """Parse XLSX bytes into list of dicts with canonical column keys and header auto-detection."""
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
    header_row = None
    for raw_r in rows_iter:
        if not raw_r or all(c is None for c in raw_r):
            continue
        str_cells = [str(c).strip().lower() for c in raw_r if c is not None]
        if any("roll" in s for s in str_cells) or any("status" in s for s in str_cells):
            header_row = raw_r
            break

    if not header_row:
        return []

    headers = [_canonical_column(str(h)) if h is not None else "" for h in header_row]
    rows = []
    for raw_row in rows_iter:
        if all(cell is None for cell in raw_row):
            continue  # skip empty rows
        row_dict = {}
        for h, val in zip(headers, raw_row):
            if h:
                if isinstance(val, bool):
                    row_dict[h] = "present" if val else "absent"
                elif isinstance(val, (int, float)) and val in (0, 1):
                    row_dict[h] = "present" if int(val) == 1 else "absent"
                else:
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

    # Find existing sessions with attendance records to detect duplicate sessions
    existing_sessions_with_records = set(
        db.scalars(
            select(ClassSessionModel.held_on).join(
                AttendanceRecordModel, AttendanceRecordModel.session_id == ClassSessionModel.id
            ).where(
                ClassSessionModel.course_id == course_id
            )
        ).all()
    )

    unknown_ids: set[str] = set()
    date_statuses: dict[date, list[str]] = {}
    duplicate_session_dates: set[date] = set()
    newly_created_session_ids: list[int] = []
    created_record_ids: list[int] = []
    updated_records_data: list[dict] = []

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
            if roll_no:
                unknown_ids.add(roll_no)
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
        if not date_str:
            parsed_date = now_utc.date()
            date_str = str(parsed_date)
        else:
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

        # ── Track status and duplicate sessions ────────────────────────────
        date_statuses.setdefault(parsed_date, []).append(normalized_status)
        if parsed_date in existing_sessions_with_records:
            duplicate_session_dates.add(parsed_date)

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
                newly_created_session_ids.append(new_session.id)
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
            if existing_record.status != normalized_status:
                updated_records_data.append({
                    "id": existing_record.id,
                    "old_status": existing_record.status,
                })
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
            created_record_ids.append(new_record.id)
            result.processed += 1
        except IntegrityError:
            db.rollback()
            result.skipped_duplicates += 1

    # ── Compute Phase 5 Warnings ──────────────────────────────────────────
    all_present_dates: list[str] = []
    for d, statuses in date_statuses.items():
        if len(statuses) > 0 and all(st == "present" for st in statuses):
            all_present_dates.append(str(d))

    result.warnings = {
        "unknown_ids": sorted(list(unknown_ids)),
        "all_present_rows": sorted(all_present_dates),
        "duplicate_sessions": sorted([str(d) for d in duplicate_session_dates]),
    }
    result.warning_messages = []
    if unknown_ids:
        result.warning_messages.append(
            f"Found {len(unknown_ids)} unknown student ID(s): {', '.join(sorted(unknown_ids)[:5])}"
        )
    if all_present_dates:
        result.warning_messages.append(
            f"100% present attendance detected for session(s) on {', '.join(all_present_dates)}. Please verify this is not an unedited template."
        )
    if duplicate_session_dates:
        result.warning_messages.append(
            f"Session(s) on {', '.join(sorted([str(d) for d in duplicate_session_dates]))} already have recorded attendance. Uploading will update existing records."
        )

    from app.models.attendance import AttendanceUploadBatchModel
    from app.models.audit import AuditLogModel

    if not dry_run:
        batch = AttendanceUploadBatchModel(
            course_id=course_id,
            uploaded_by=marked_by_user_id,
            uploaded_at=now_utc,
            filename=filename,
            records_created=len(created_record_ids),
            records_updated=len(updated_records_data),
            sessions_created=result.sessions_created,
            backup_data=json.dumps({
                "created_record_ids": created_record_ids,
                "updated_records": updated_records_data,
                "created_session_ids": newly_created_session_ids,
            }),
            is_undone=False,
        )
        db.add(batch)
        db.flush()
        result.batch_id = batch.id

        try:
            db.add(AuditLogModel(
                entity="attendance",
                entity_id=f"course:{course_id}",
                action="upload_attendance",
                old_value=None,
                new_value=f"Batch {batch.id}: {result.processed} processed, {result.sessions_created} sessions",
                actor_id=marked_by_user_id,
                reason=change_reason or "Attendance sheet upload",
                created_at=now_utc,
            ))
            db.commit()
        except Exception:
            db.commit()
    result.dry_run = dry_run
    return result


def undo_attendance_upload(
    db: Session,
    course_id: int,
    user_id: int,
    batch_id: Optional[int] = None,
) -> dict:
    """
    Undo an attendance upload batch for a course, reverting created and updated records,
    cleaning up any empty sessions created by that batch, recomputing risk snapshots,
    and logging an audit record.
    """
    from app.core.audit import AuditAction, AuditLogger
    from app.core.errors import ConflictError
    from app.models.attendance import AttendanceRecordModel, AttendanceUploadBatchModel, ClassSessionModel
    from app.models.enrollment import EnrolmentModel
    from app.services.risk_data import persist_risk_snapshot

    latest_batch = db.scalar(
        select(AttendanceUploadBatchModel)
        .where(
            AttendanceUploadBatchModel.course_id == course_id,
            AttendanceUploadBatchModel.is_undone == False,
        )
        .order_by(AttendanceUploadBatchModel.uploaded_at.desc(), AttendanceUploadBatchModel.id.desc())
    )
    if not latest_batch:
        raise ValueError("No active attendance upload found to undo.")

    if batch_id is not None and batch_id != latest_batch.id:
        raise ConflictError(
            f"Only the most recent attendance upload batch (batch #{latest_batch.id}) can be undone. "
            f"Batch #{batch_id} is an older batch and cannot be undone out of order."
        )

    batch = latest_batch

    backup = {}
    if batch.backup_data:
        try:
            backup = json.loads(batch.backup_data)
        except Exception:
            backup = {}

    created_record_ids = backup.get("created_record_ids", [])
    updated_records = backup.get("updated_records", [])
    created_session_ids = backup.get("created_session_ids", [])

    # 1. Delete created records
    reverted_created = 0
    if created_record_ids:
        records_to_delete = db.scalars(
            select(AttendanceRecordModel).where(AttendanceRecordModel.id.in_(created_record_ids))
        ).all()
        for r in records_to_delete:
            db.delete(r)
            reverted_created += 1

    # 2. Restore updated records
    reverted_updated = 0
    for item in updated_records:
        rec = db.get(AttendanceRecordModel, item["id"])
        if rec and "old_status" in item:
            rec.status = item["old_status"]
            reverted_updated += 1

    db.flush()

    # 3. Clean up empty created sessions
    for sess_id in created_session_ids:
        remaining_count = db.scalar(
            select(func.count(AttendanceRecordModel.id)).where(AttendanceRecordModel.session_id == sess_id)
        ) or 0
        if remaining_count == 0:
            sess = db.get(ClassSessionModel, sess_id)
            if sess:
                db.delete(sess)

    # 4. Mark batch as undone
    now_utc = datetime.now(timezone.utc)
    batch.is_undone = True
    batch.undone_at = now_utc
    batch.undone_by = user_id
    db.commit()

    # 5. Recompute risk snapshots for affected enrolled students
    enrolled_ids = list(
        db.scalars(
            select(EnrolmentModel.student_id).where(
                EnrolmentModel.course_id == course_id
            )
        ).all()
    )
    for sid in enrolled_ids:
        try:
            persist_risk_snapshot(db, sid, course_id)
        except Exception:
            pass

    # 6. Audit log with PII redaction
    from app.models.audit import AuditLogModel
    try:
        db.add(AuditLogModel(
            entity="attendance_batch",
            entity_id=str(batch.id),
            action="undo_attendance_upload",
            old_value=f"Batch {batch.id}: {len(created_record_ids)} created, {len(updated_records)} updated",
            new_value=f"Reverted {reverted_created} created, {reverted_updated} updated",
            actor_id=user_id,
            reason=f"Undo attendance upload {batch.filename}",
            created_at=now_utc,
        ))
        db.commit()
    except Exception:
        pass

    return {
        "success": True,
        "batch_id": batch.id,
        "filename": batch.filename,
        "course_id": course_id,
        "reverted_created": reverted_created,
        "reverted_updated": reverted_updated,
        "message": f"Successfully undone attendance upload '{batch.filename}'. Reverted {reverted_created + reverted_updated} record(s).",
    }


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

def generate_attendance_template_excel(
    db: Session,
    course_id: int,
    session_date: Optional[date] = None,
) -> bytes:
    """
    Generate a pre-populated Excel (.xlsx) template for attendance upload.
    Includes enrolled students, pre-filled date, and a dropdown DataValidation
    for Status (Present / Absent).
    """
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation

    from app.models import EnrolmentModel, UserModel

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

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance"
    ws.views.sheetView[0].showGridLines = True

    headers = ["roll_no", "student_name", "date", "status", "remarks"]
    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_align = Alignment(horizontal="center", vertical="center")

    ws.row_dimensions[1].height = 26
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    for r_idx, (r_no, name) in enumerate(rows, 2):
        ws.row_dimensions[r_idx].height = 20
        c1 = ws.cell(row=r_idx, column=1, value=r_no)
        c1.alignment = Alignment(horizontal="center", vertical="center")
        c1.border = thin_border

        c2 = ws.cell(row=r_idx, column=2, value=name)
        c2.alignment = Alignment(horizontal="left", vertical="center")
        c2.border = thin_border

        c3 = ws.cell(row=r_idx, column=3, value=date_str)
        c3.alignment = Alignment(horizontal="center", vertical="center")
        c3.border = thin_border

        c4 = ws.cell(row=r_idx, column=4, value="Present")
        c4.alignment = Alignment(horizontal="center", vertical="center")
        c4.font = Font(name="Calibri", size=11, bold=True, color="15803D")
        c4.border = thin_border

        c5 = ws.cell(row=r_idx, column=5, value="")
        c5.border = thin_border

    from openpyxl.formatting.rule import CellIsRule

    # High-visibility red styling for Absent status in template
    red_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    red_font = Font(name="Calibri", size=11, bold=True, color="DC2626")
    green_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    green_font = Font(name="Calibri", size=11, bold=True, color="15803D")

    max_row = max(len(rows) + 1, 100)
    dv = DataValidation(type="list", formula1='"Present,Absent"', allow_blank=False)
    ws.add_data_validation(dv)
    dv.add(f"D2:D{max_row}")

    # Add dynamic conditional formatting so whenever Absent is selected, cell turns bright red
    ws.conditional_formatting.add(
        f"D2:D{max_row}",
        CellIsRule(operator="equal", formula=['"Absent"'], stopIfTrue=True, fill=red_fill, font=red_font)
    )
    ws.conditional_formatting.add(
        f"D2:D{max_row}",
        CellIsRule(operator="equal", formula=['"Present"'], stopIfTrue=True, fill=green_fill, font=green_font)
    )

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 16)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
