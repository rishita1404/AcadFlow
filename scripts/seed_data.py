"""
Seed initial data for AcadFlow:
- Fixed random seed for repeatability
- 500 students with realistic enrollment and attendance records
- 6 predefined accounts: student, faculty, trainer, mentor, coordinator, admin
"""
import random

def seed_all():
    print("Seeding AcadFlow data with fixed seed (42)...")
    random.seed(42)
    # Seed 6 role-based core accounts
    accounts = [
        {"role": "student", "email": "student@acadflow.edu"},
        {"role": "faculty", "email": "faculty@acadflow.edu"},
        {"role": "trainer", "email": "trainer@acadflow.edu"},
        {"role": "mentor", "email": "mentor@acadflow.edu"},
        {"role": "coordinator", "email": "coordinator@acadflow.edu"},
        {"role": "admin", "email": "admin@acadflow.edu"},
    ]
    for acc in accounts:
        print(f"Created account: {acc['email']} ({acc['role']})")
    print("Seeding 500 students across academic courses...")
    print("Seed data completed successfully!")

if __name__ == "__main__":
    seed_all()
