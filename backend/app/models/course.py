from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class CourseModel(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
