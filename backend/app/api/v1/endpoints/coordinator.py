from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_coordinator_index():
    return {"endpoint": "coordinator", "status": "active"}
