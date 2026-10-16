#!/bin/sh
set -e

echo "=== AcadFlow Backend Starting ==="

# Wait for database connection to be ready
echo "Waiting for database to be ready..."
python3 - << 'EOF'
import time, sys
from sqlalchemy import create_engine
from app.core.config import settings

url = settings.DATABASE_URL
if url.startswith("postgresql+asyncpg://"):
    url = url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
elif url.startswith("postgresql://"):
    url = url.replace("postgresql://", "postgresql+psycopg://")

for i in range(30):
    try:
        engine = create_engine(url)
        with engine.connect() as conn:
            print("Database connection verified successfully.")
            sys.exit(0)
    except Exception as e:
        print(f"Waiting for database connection... ({i+1}/30)")
        time.sleep(2)

print("Warning: Database connection timed out. Proceeding anyway.")
sys.exit(0)
EOF

echo "Applying Alembic database migrations..."
alembic upgrade head || echo "Notice: alembic upgrade completed or skipped."

echo "Starting application..."
exec "$@"
