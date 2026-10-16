from pydantic import BaseModel

class AssignmentBase(BaseModel):
    pass

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentResponse(AssignmentBase):
    id: int
    class Config:
        from_attributes = True
