import asyncio
import inspect
import sys
from datetime import date
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.deps import get_db
from app.db.base import Base
from app.main import app
from app.models import DepartmentModel, SemesterModel, StudentModel, UserModel


def pytest_pyfunc_call(pyfuncitem):
    """Run async test functions in an asyncio event loop without requiring pytest-asyncio."""
    if inspect.iscoroutinefunction(pyfuncitem.obj):
        sig = inspect.signature(pyfuncitem.obj)
        kwargs = {k: v for k, v in pyfuncitem.funcargs.items() if k in sig.parameters}
        asyncio.run(pyfuncitem.obj(**kwargs))
        return True


# Separate isolated in-memory test database
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Seed initial test prerequisites (Department, Semester, Students)
    dept = DepartmentModel(name="Computer Science & Engineering", code="CSE")
    session.add(dept)
    sem = SemesterModel(
        name="Semester 5 (2026)",
        start_date=date(2026, 7, 15),
        end_date=date(2026, 12, 20),
    )
    session.add(sem)
    session.flush()

    user1 = UserModel(
        name="Student One",
        email="student1@acadflow.edu",
        password_hash="hash1",
        role="student",
        department_id=dept.id,
    )
    user2 = UserModel(
        name="Student Two",
        email="student2@acadflow.edu",
        password_hash="hash2",
        role="student",
        department_id=dept.id,
    )
    session.add_all([user1, user2])
    session.flush()

    s1 = StudentModel(user_id=user1.id, roll_no="24CAI001", batch="2026")
    s2 = StudentModel(user_id=user2.id, roll_no="24CAI002", batch="2026")
    session.add_all([s1, s2])
    session.commit()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
async def async_client():
    """Async client for security tests (Member 2)."""
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
