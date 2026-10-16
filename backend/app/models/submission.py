from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class SubmissionModel(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
