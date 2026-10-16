from enum import Enum


class Role(str, Enum):
    STUDENT = "student"
    FACULTY = "faculty"
    TRAINER = "trainer"
    MENTOR = "mentor"
    COORDINATOR = "coordinator"
    ADMIN = "admin"
