import sqlite3
from pathlib import Path

db_path = Path("d:/AcadFlow/backend/acadflow.db")
con = sqlite3.connect(db_path)
cur = con.cursor()

print("=" * 60)
print("ACADFLOW AI-ML DEPARTMENT VERIFICATION")
print("=" * 60)

cur.execute("SELECT id, code, name FROM departments WHERE code = 'AIML'")
dept = cur.fetchone()
print("Department:", dept)
dept_id = dept[0]

cur.execute("SELECT count(*) FROM users WHERE department_id = ? AND role = 'student'", (dept_id,))
print("Total Students:", cur.fetchone()[0])

cur.execute("SELECT id, name, email, role FROM users WHERE department_id = ? AND role IN ('faculty', 'coordinator')", (dept_id,))
print("\nFaculty & Staff Members:")
for f in cur.fetchall():
    print(f"  [{f[3].upper()}] {f[1]} ({f[2]})")

cur.execute("SELECT id, code, name, total_classes FROM courses WHERE department_id = ?", (dept_id,))
print("\nCourses (Subjects):")
courses = cur.fetchall()
for c in courses:
    print(f"  {c[1]} - {c[2]} (Total classes: {c[3]})")

cur.execute("""
    SELECT cs.course_id, c.code, u.name, cs.role 
    FROM course_staff cs 
    JOIN courses c ON cs.course_id = c.id 
    JOIN users u ON cs.user_id = u.id 
    WHERE c.department_id = ?
    ORDER BY c.code, cs.role
""", (dept_id,))
print("\nCourse Staff Assignments:")
for row in cur.fetchall():
    print(f"  {row[1]}: {row[2]} as {row[3]}")

cur.execute("SELECT count(*) FROM enrolments WHERE course_id IN (SELECT id FROM courses WHERE department_id = ?)", (dept_id,))
print("\nTotal Enrolments in AIML Courses:", cur.fetchone()[0])

cur.execute("""
    SELECT count(*) FROM class_sessions 
    WHERE course_id IN (SELECT id FROM courses WHERE department_id = ?)
""", (dept_id,))
print("Total Held Class Sessions:", cur.fetchone()[0])

cur.execute("""
    SELECT count(*) FROM attendance_records 
    WHERE session_id IN (
        SELECT id FROM class_sessions 
        WHERE course_id IN (SELECT id FROM courses WHERE department_id = ?)
    )
""", (dept_id,))
print("Total Attendance Records:", cur.fetchone()[0])

cur.execute("""
    SELECT count(*) FROM assignments 
    WHERE course_id IN (SELECT id FROM courses WHERE department_id = ?)
""", (dept_id,))
print("Total Assignments:", cur.fetchone()[0])

cur.execute("""
    SELECT count(*) FROM submissions 
    WHERE assignment_id IN (
        SELECT id FROM assignments 
        WHERE course_id IN (SELECT id FROM courses WHERE department_id = ?)
    )
""", (dept_id,))
print("Total Submissions:", cur.fetchone()[0])

cur.execute("""
    SELECT section, count(*) 
    FROM timetable_slots 
    WHERE course_id IN (SELECT id FROM courses WHERE department_id = ?)
    GROUP BY section
    ORDER BY section
""", (dept_id,))
print("\nTimetable Slots per Section:")
for row in cur.fetchall():
    print(f"  Section {row[0]}: {row[1]} periods scheduled")

# Check risk snapshots for AIML students
cur.execute("""
    SELECT rs.band, count(*)
    FROM risk_snapshots rs
    JOIN students st ON rs.student_id = st.user_id
    WHERE st.roll_no LIKE '26AIML%'
    GROUP BY rs.band
""")
print("\nRisk Band Distribution for AIML Students:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} students")

print("\nSection A Students:")
cur.execute("SELECT u.id, u.email, u.name, s.roll_no FROM users u JOIN students s ON u.id = s.user_id WHERE u.department_id = ? AND u.role = 'student' ORDER BY s.roll_no LIMIT 25", (dept_id,))
for r in cur.fetchall():
    print(f"  {r[3]}: {r[2]} ({r[1]})")

print("=" * 60)
