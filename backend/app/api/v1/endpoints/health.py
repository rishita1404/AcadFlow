from fastapi import APIRouter

router = APIRouter()


@router.get("", tags=["Health"])
@router.get("/", tags=["Health"])
def get_health():
    """Health check endpoint."""
    return {"status": "ok"}
