from datetime import date
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class EnrolmentItem(BaseModel):
    student_id: int = Field(..., description="Student user_id")
    enrolled_on: Optional[date] = Field(
        None, description="Enrolment date (defaults to today)"
    )


class EnrolmentBatchCreate(BaseModel):
    students: List[EnrolmentItem] = Field(
        ..., min_length=1, description="List of students to enrol"
    )


class EnrolmentOut(BaseModel):
    student_id: int
    course_id: int
    enrolled_on: date

    model_config = ConfigDict(from_attributes=True)
