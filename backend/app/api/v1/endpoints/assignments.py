from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_assignments_index():
    return {"endpoint": "assignments", "status": "active"}
