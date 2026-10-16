from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class RiskModel(Base):
    __tablename__ = "risks"
    id = Column(Integer, primary_key=True, index=True)
