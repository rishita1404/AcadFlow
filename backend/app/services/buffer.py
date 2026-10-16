def compute_attendance_buffer(attended: int, total_conducted: int, total_classes: int, threshold: float = 0.75) -> int:
    """
    Computes attendance buffer: how many future classes the student can miss
    while still meeting the threshold attendance percentage (default 75%).
    """
    min_required_attended = int(total_classes * threshold)
    # Remaining classes
    remaining = total_classes - total_conducted
    # Maximum classes that can be missed
    can_miss = (attended + remaining) - min_required_attended
    return max(0, can_miss)
