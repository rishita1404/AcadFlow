from pydantic import BaseModel

class AttendanceBase(BaseModel):
    pass

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    id: int
    class Config:
        from_attributes = True
