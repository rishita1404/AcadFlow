from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class NotificationModel(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
