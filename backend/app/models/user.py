from sqlalchemy import Column, Integer

from app.db.base import Base


class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
