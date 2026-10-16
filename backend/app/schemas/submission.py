from pydantic import BaseModel


class SubmissionBase(BaseModel):
    pass


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionResponse(SubmissionBase):
    id: int

    class Config:
        from_attributes = True
