from sqlalchemy import Column, Integer

from app.db.base import Base


class AttendanceModel(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True, index=True)
