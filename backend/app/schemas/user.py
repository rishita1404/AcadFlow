from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(...)
    role: str = Field(default="student")
    department_id: Optional[int] = None
    organization_id: Optional[int] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserOut(UserBase):
    id: int
    failed_logins: int

    model_config = ConfigDict(from_attributes=True)


class StudentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(...)
    password: str = Field(..., min_length=6, max_length=100)
    roll_no: str = Field(..., min_length=1, max_length=50)
    batch: str = Field(..., min_length=1, max_length=50)
    department_id: Optional[int] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    roll_no: Optional[str] = Field(None, min_length=1, max_length=50)
    batch: Optional[str] = Field(None, min_length=1, max_length=50)
    department_id: Optional[int] = None


class StudentOut(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    roll_no: str
    batch: str
    department_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
