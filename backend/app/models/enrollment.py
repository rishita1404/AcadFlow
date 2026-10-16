from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class EnrollmentModel(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
