def test_health_returns_status_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_course(client):
    payload = {
        "code": "24CAI0304",
        "name": "Full Stack AI Engineering",
        "semester_id": 1,
        "department_id": 1,
        "total_classes": 45,
    }
    response = client.post("/api/v1/courses", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "24CAI0304"
    assert data["name"] == "Full Stack AI Engineering"
    assert data["total_classes"] == 45
    assert "id" in data


def test_duplicate_course_code_returns_409(client):
    payload = {
        "code": "DUP101",
        "name": "Duplicate Test Course",
        "semester_id": 1,
        "department_id": 1,
        "total_classes": 30,
    }
    # First creation should succeed
    res1 = client.post("/api/v1/courses", json=payload)
    assert res1.status_code == 201

    # Second creation with identical code must return 409 CONFLICT
    res2 = client.post("/api/v1/courses", json=payload)
    assert res2.status_code == 409
    error_data = res2.json()
    assert "error" in error_data
    assert error_data["error"]["code"] == "CONFLICT"


def test_unknown_course_returns_404_in_error_format(client):
    response = client.get("/api/v1/courses/999999")
    assert response.status_code == 404
    error_data = response.json()
    assert "error" in error_data
    assert error_data["error"]["code"] == "NOT_FOUND"
    assert "Course with id 999999 not found" in error_data["error"]["message"]


def test_list_courses_with_pagination_and_sort(client):
    # Create 3 courses with different class counts
    courses_to_create = [
        {
            "code": "SORT_A",
            "name": "Algorithms",
            "semester_id": 1,
            "department_id": 1,
            "total_classes": 40,
        },
        {
            "code": "SORT_B",
            "name": "Basic Electronics",
            "semester_id": 1,
            "department_id": 1,
            "total_classes": 60,
        },
        {
            "code": "SORT_C",
            "name": "Calculus",
            "semester_id": 1,
            "department_id": 1,
            "total_classes": 50,
        },
    ]
    for c in courses_to_create:
        res = client.post("/api/v1/courses", json=c)
        assert res.status_code == 201

    # 1. Test pagination: page=1, page_size=2
    res_page1 = client.get("/api/v1/courses?code=SORT_&page=1&page_size=2")
    assert res_page1.status_code == 200
    data_page1 = res_page1.json()
    assert data_page1["total"] == 3
    assert data_page1["page"] == 1
    assert data_page1["page_size"] == 2
    assert len(data_page1["items"]) == 2

    # 2. Test sort by -total_classes (descending)
    res_sorted = client.get("/api/v1/courses?code=SORT_&sort=-total_classes")
    assert res_sorted.status_code == 200
    items = res_sorted.json()["items"]
    assert len(items) == 3
    assert items[0]["code"] == "SORT_B"  # 60 classes
    assert items[1]["code"] == "SORT_C"  # 50 classes
    assert items[2]["code"] == "SORT_A"  # 40 classes


def test_duplicate_enrolment_returns_409(client):
    # Create a course first
    course_payload = {
        "code": "ENROL101",
        "name": "Enrolment Course",
        "semester_id": 1,
        "department_id": 1,
        "total_classes": 40,
    }
    course_res = client.post("/api/v1/courses", json=course_payload)
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # Enrol student 1 (seeded in conftest with user_id 1)
    enrol_payload = {"students": [{"student_id": 1, "enrolled_on": "2026-08-01"}]}
    res1 = client.post(f"/api/v1/courses/{course_id}/enrolments", json=enrol_payload)
    assert res1.status_code == 201
    assert len(res1.json()) == 1
    assert res1.json()[0]["student_id"] == 1

    # Attempting to enrol student 1 again must return 409 CONFLICT
    res2 = client.post(f"/api/v1/courses/{course_id}/enrolments", json=enrol_payload)
    assert res2.status_code == 409
    error_data = res2.json()
    assert "error" in error_data
    assert error_data["error"]["code"] == "CONFLICT"
    assert "already enrolled" in error_data["error"]["message"].lower()
