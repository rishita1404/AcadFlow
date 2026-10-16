def test_create_and_get_student(client):
    payload = {
        "name": "Riya Sharma",
        "email": "riya.sharma@acadflow.edu",
        "password": "Password123!",
        "roll_no": "24CAI101",
        "batch": "2026",
        "department_id": 1,
    }
    # Create student
    res = client.post("/api/v1/students", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Riya Sharma"
    assert data["email"] == "riya.sharma@acadflow.edu"
    assert data["roll_no"] == "24CAI101"
    user_id = data["user_id"]

    # Retrieve student by user_id
    res_get = client.get(f"/api/v1/students/{user_id}")
    assert res_get.status_code == 200
    assert res_get.json()["user_id"] == user_id


def test_duplicate_student_email_or_roll_returns_409(client):
    payload = {
        "name": "Dev Kumar",
        "email": "dev.kumar@acadflow.edu",
        "password": "Password123!",
        "roll_no": "24CAI102",
        "batch": "2026",
    }
    res1 = client.post("/api/v1/students", json=payload)
    assert res1.status_code == 201

    # Duplicate email
    payload_dup_email = {**payload, "roll_no": "24CAI103"}
    res_email = client.post("/api/v1/students", json=payload_dup_email)
    assert res_email.status_code == 409
    assert res_email.json()["error"]["code"] == "CONFLICT"

    # Duplicate roll_no
    payload_dup_roll = {**payload, "email": "dev.other@acadflow.edu"}
    res_roll = client.post("/api/v1/students", json=payload_dup_roll)
    assert res_roll.status_code == 409
    assert res_roll.json()["error"]["code"] == "CONFLICT"


def test_unknown_student_returns_404(client):
    res = client.get("/api/v1/students/999999")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"
