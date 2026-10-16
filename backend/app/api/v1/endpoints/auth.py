from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_auth_index():
    return {"endpoint": "auth", "status": "active"}
