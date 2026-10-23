from app.db.base import Base
from app.models.assignment import AssignmentModel
from app.models.attendance import AttendanceRecordModel, ClassSessionModel
from app.models.audit import AuditLogModel
from app.models.course import CourseModel, CourseStaffModel, HolidayModel, SemesterModel
from app.models.enrollment import EnrolmentModel
from app.models.notice import (
    NoticeDeadlineModel,
    NoticeModel,
    NoticeRecipientModel,
)
from app.models.notification import NotificationModel
from app.models.risk import RiskConfigModel, RiskSnapshotModel
from app.models.student_holiday import StudentHolidayModel
from app.models.submission import SubmissionModel
from app.models.timetable import (
    PeriodConfigModel,
    RoomModel,
    TimetableSlotModel,
    TimetableVersionModel,
)
from app.models.user import (
    DeanAssignmentModel,
    DepartmentModel,
    MentorAssignmentModel,
    OrganizationModel,
    StudentModel,
    UserModel,
)

__all__ = [
    "Base",
    "OrganizationModel",
    "DepartmentModel",
    "UserModel",
    "StudentModel",
    "DeanAssignmentModel",
    "MentorAssignmentModel",
    "SemesterModel",
    "HolidayModel",
    "CourseModel",
    "CourseStaffModel",
    "EnrolmentModel",
    "ClassSessionModel",
    "AttendanceRecordModel",
    "AssignmentModel",
    "SubmissionModel",
    "RiskConfigModel",
    "RiskSnapshotModel",
    "AuditLogModel",
    "NotificationModel",
    "StudentHolidayModel",
    "RoomModel",
    "TimetableVersionModel",
    "PeriodConfigModel",
    "TimetableSlotModel",
    "NoticeModel",
    "NoticeRecipientModel",
    "NoticeDeadlineModel",
]
