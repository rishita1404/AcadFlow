from app.services.buffer import compute_attendance_buffer


def test_compute_attendance_buffer():
    # 40 total classes, 20 conducted, 18 attended
    # 75% of 40 = 30 required classes
    # Attended 18, remaining 20 -> can attain max 38
    # Can miss: 38 - 30 = 8 classes
    buffer_classes = compute_attendance_buffer(
        attended=18, total_conducted=20, total_classes=40, threshold=0.75
    )
    assert buffer_classes == 8
