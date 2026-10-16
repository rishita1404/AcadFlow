from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class AttendanceModel(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True, index=True)
