from pydantic import BaseModel


class UserBase(BaseModel):
    pass


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True
