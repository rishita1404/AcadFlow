from pydantic import BaseModel

class RiskBase(BaseModel):
    pass

class RiskCreate(RiskBase):
    pass

class RiskResponse(RiskBase):
    id: int
    class Config:
        from_attributes = True
