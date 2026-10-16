from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_admin_index():
    return {"endpoint": "admin", "status": "active"}
