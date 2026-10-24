from typing import Annotated, Generic, List, TypeVar

from pydantic import BaseModel, ConfigDict, StringConstraints

T = TypeVar("T")

try:
    import email_validator  # noqa: F401
    from pydantic import EmailStr
except ImportError:
    EmailStr = Annotated[
        str,
        StringConstraints(pattern=r"^[\w\.\+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-\.]+$"),
    ]


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int

    model_config = ConfigDict(from_attributes=True)
