import logging

from app.core.config import settings

logger = logging.getLogger("acadflow.mongo")

mongo_client = None
mongo_db = None

try:
    from motor.motor_asyncio import AsyncIOMotorClient

    uri = settings.MONGO_URI or ""
    if uri:
        mongo_client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
        )
        try:
            default_db = mongo_client.get_default_database(default="acadflow_mongo").name
        except Exception:
            default_db = "acadflow_mongo"
        mongo_db = mongo_client[default_db]
        logger.info(
            "Configured MongoDB client with URI: %s",
            uri.split("@")[-1] if "@" in uri else uri,
        )
except Exception as e:
    logger.warning("MongoDB initialization failed: %s", e)
    mongo_client = None
    mongo_db = None
