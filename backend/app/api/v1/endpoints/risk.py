from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_risk_index():
    return {"endpoint": "risk", "status": "active"}
