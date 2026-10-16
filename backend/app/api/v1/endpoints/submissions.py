from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_submissions_index():
    return {"endpoint": "submissions", "status": "active"}
