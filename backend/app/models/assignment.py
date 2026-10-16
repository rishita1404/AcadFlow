from sqlalchemy import Column, Integer

from app.db.base import Base


class AssignmentModel(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
