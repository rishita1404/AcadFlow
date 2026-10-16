from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_mentor_index():
    return {"endpoint": "mentor", "status": "active"}
