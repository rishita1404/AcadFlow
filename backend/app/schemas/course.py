from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CourseBase(BaseModel):
    code: str = Field(
        ..., min_length=1, max_length=50, description="Unique course code e.g. CS101"
    )
    name: str = Field(..., min_length=1, max_length=150, description="Full course name")
    semester_id: int = Field(..., description="ID of semester")
    department_id: int = Field(..., description="ID of department")
    total_classes: int = Field(
        ..., gt=0, description="Total planned classes in semester"
    )


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    semester_id: Optional[int] = None
    department_id: Optional[int] = None
    total_classes: Optional[int] = Field(None, gt=0)


class CourseOut(CourseBase):
    id: int
    enrolled_count: Optional[int] = None
    avg_attendance: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
