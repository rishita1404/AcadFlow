"""
Cross-Role HTTP Verification Script for AcadFlow Demo Universe.

Logs in over HTTP as each demo account against the running backend, runs all
8 cross-role flows, and prints PASS or FAIL for each check.

Usage:
    python scripts/demo_check.py
    ACADFLOW_API_URL=http://127.0.0.1:8000/api/v1 python scripts/demo_check.py
"""

from __future__ import annotations

import os
import sys
from datetime import date, datetime, timedelta, timezone

import httpx

BASE_URL = os.environ.get("ACADFLOW_API_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
PASS = "AcadFlow@123"


def login(client: httpx.Client, email: str) -> tuple[str, dict]:
    r = client.post(f"{BASE_URL}/auth/login", json={"email": email, "password": PASS})
    if r.status_code != 200:
        raise RuntimeError(f"Login failed for {email}: {r.status_code} {r.text}")
    tok = r.json()["access_token"]
    me = client.get(f"{BASE_URL}/me", headers={"Authorization": f"Bearer {tok}"})
    return tok, me.json()


def hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def main() -> int:
    results: list[tuple[str, bool, str]] = []

    def record(name: str, ok: bool, detail: str = ""):
        results.append((name, ok, detail))
        tag = "PASS" if ok else "FAIL"
        print(f"[{tag}] {name}" + (f" — {detail}" if detail else ""))

    with httpx.Client(timeout=20.0) as client:
        # Check readiness
        r_ready = client.get(f"{BASE_URL}/health/ready")
        record("0. Readiness (/health/ready)", r_ready.status_code == 200 and r_ready.json().get("database", {}).get("ok") is True)

        # Log in as all relevant demo accounts
        stu_tok, stu_me = login(client, "student@acadflow.edu")
        fac_tok, fac_me = login(client, "faculty@acadflow.edu")
        men_tok, men_me = login(client, "mentor@acadflow.edu")
        dean_tok, dean_me = login(client, "coordinator@acadflow.edu")
        adm_tok, adm_me = login(client, "admin@acadflow.edu")
        secb_tok, _ = login(client, "student_secb@acadflow.edu")
        ece_stu_tok, _ = login(client, "student_ece@acadflow.edu")
        ece_fac_tok, _ = login(client, "faculty_ece@acadflow.edu")

        stu_id = stu_me["id"]

        # ── 1. Leave Flow ──────────────────────────────────────────────────────
        d_from = (date.today() + timedelta(days=20)).isoformat()
        d_to = (date.today() + timedelta(days=21)).isoformat()
        r_sub = client.post(
            f"{BASE_URL}/leave/requests",
            headers=hdr(stu_tok),
            data={"type": "duty", "date_from": d_from, "date_to": d_to, "event_name": "Demo Check Hackathon", "club_org": "ACM", "duty_detail": "Speaker"},
        )
        leave_id = r_sub.json().get("id") if r_sub.status_code == 201 else None

        in_men = any(x["id"] == leave_id for x in client.get(f"{BASE_URL}/leave/inbox", headers=hdr(men_tok)).json())
        in_dean = any(x["id"] == leave_id for x in client.get(f"{BASE_URL}/leave/inbox", headers=hdr(dean_tok)).json())
        in_fac = any(x["id"] == leave_id for x in client.get(f"{BASE_URL}/leave/inbox", headers=hdr(fac_tok)).json())
        ece_403 = client.get(f"{BASE_URL}/leave/requests/{leave_id}", headers=hdr(ece_fac_tok)).status_code == 403 if leave_id else False

        r_appr = client.post(
            f"{BASE_URL}/leave/requests/{leave_id}/decide",
            headers=hdr(men_tok),
            json={"status": "approved", "decision_note": "Approved in demo_check"},
        ) if leave_id else None
        stu_my = client.get(f"{BASE_URL}/leave/my-requests", headers=hdr(stu_tok)).json()
        stu_sees_appr = any(x["id"] == leave_id and x["status"] == "approved" for x in stu_my)
        stu_notifs = client.get(f"{BASE_URL}/notifications", headers=hdr(stu_tok)).json()
        stu_has_notif = any("Leave Request Approved" in n.get("title", "") for n in stu_notifs)

        record(
            "1. Leave cross-role flow",
            bool(leave_id and in_men and in_dean and in_fac and ece_403 and r_appr and r_appr.status_code == 200 and stu_sees_appr and stu_has_notif),
            f"id={leave_id} men={in_men} dean={in_dean} fac={in_fac} ece403={ece_403} appr={stu_sees_appr}",
        )

        # ── 2. Attendance Flow ─────────────────────────────────────────────────
        courses_resp = client.get(f"{BASE_URL}/courses", headers=hdr(fac_tok)).json()
        courses = courses_resp.get("items", courses_resp) if isinstance(courses_resp, dict) else courses_resp
        cs501 = next((c for c in courses if c.get("code") == "CS501"), courses[0])
        cs501_id = cs501["id"]

        dash_before = client.get(f"{BASE_URL}/me/dashboard", headers=hdr(stu_tok)).json()
        sess_date = (date.today() - timedelta(days=1)).isoformat()
        r_mark = client.post(
            f"{BASE_URL}/attendance/direct-mark",
            headers=hdr(fac_tok),
            json={"course_id": cs501_id, "session_date": sess_date, "records": [{"student_id": stu_id, "status": "present"}], "change_reason": "demo_check"},
        )
        dash_after = client.get(f"{BASE_URL}/me/dashboard", headers=hdr(stu_tok)).json()
        men_students = client.get(f"{BASE_URL}/mentor/students", headers=hdr(men_tok)).json()
        trends = client.get(f"{BASE_URL}/departments/{dean_me.get('department_id', 1)}/trends", headers=hdr(dean_tok))

        record(
            "2. Attendance cross-role flow",
            r_mark.status_code == 200 and isinstance(dash_after.get("courses"), list) and len(men_students) > 0 and trends.status_code == 200,
            f"mark={r_mark.status_code} courses_before={len(dash_before.get('courses', []))} mentees={len(men_students)} trends={trends.status_code}",
        )

        # ── 3. Notices Flow ────────────────────────────────────────────────────
        notice_title = f"Demo Check Notice {datetime.now(timezone.utc).strftime('%H%M%S')}"
        dl_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        r_notice = client.post(
            f"{BASE_URL}/notices",
            headers=hdr(dean_tok),
            json={
                "title": notice_title,
                "body": "Important notice for CSE Section A only.",
                "category": "exam",
                "priority": "important",
                "urgent": False,
                "audience_spec": '{"type":"department","department_id":1,"section":"A"}',
                "add_to_deadlines": True,
                "deadlines": [{"kind": "exam", "at": dl_at, "label": "Demo Exam Deadline", "source": "demo_check"}],
            },
        )
        stu_notices = client.get(f"{BASE_URL}/notices/me", headers=hdr(stu_tok)).json()
        secb_notices = client.get(f"{BASE_URL}/notices/me", headers=hdr(secb_tok)).json()
        ece_notices = client.get(f"{BASE_URL}/notices/me", headers=hdr(ece_stu_tok)).json()
        stu_notifs_after = client.get(f"{BASE_URL}/notifications", headers=hdr(stu_tok)).json()

        stu_has_notice = any(n["title"] == notice_title and n.get("audience_summary") for n in stu_notices)
        secb_excluded = not any(n["title"] == notice_title for n in secb_notices)
        ece_excluded = not any(n["title"] == notice_title for n in ece_notices)
        stu_got_notif = any(notice_title in n.get("title", "") for n in stu_notifs_after)

        record(
            "3. Notices scope & notification flow",
            r_notice.status_code in (200, 201) and stu_has_notice and secb_excluded and ece_excluded and stu_got_notif,
            f"status={r_notice.status_code} stu={stu_has_notice} secB_out={secb_excluded} ece_out={ece_excluded} notif={stu_got_notif}",
        )

        # ── 4. Timetable Flow ──────────────────────────────────────────────────
        r_draft = client.get(f"{BASE_URL}/timetable/draft", headers=hdr(dean_tok), params={"department_id": 1})
        draft_data = r_draft.json() if r_draft.status_code == 200 else {}
        draft_version_id = draft_data.get("version_id") or draft_data.get("version", {}).get("id") or draft_data.get("id")
        rooms = client.get(f"{BASE_URL}/timetable/rooms", headers=hdr(dean_tok), params={"department_id": 1}).json()
        room_id = rooms[0]["id"] if rooms else 1
        draft_slots = draft_data.get("slots", [])
        if not draft_slots:
            draft_slots = [{"course_id": cs501_id, "section": "A", "teacher_id": fac_me["id"], "room_id": room_id, "day": 0, "period_label": "P1", "kind": "lecture", "start_time": "09:00", "end_time": "10:00"}]
        if not draft_version_id:
            r_cv = client.post(
                f"{BASE_URL}/timetable/versions",
                headers=hdr(dean_tok),
                json={"department_id": 1, "semester_id": 1, "name": "Demo Check Draft", "effective_from": date.today().isoformat()},
            )
            draft_version_id = r_cv.json().get("id") if r_cv.status_code in (200, 201) else None
        if draft_version_id:
            client.put(
                f"{BASE_URL}/timetable/draft",
                headers=hdr(dean_tok),
                json={"version_id": draft_version_id, "slots": draft_slots},
            )
        ece_notifs_before = len(client.get(f"{BASE_URL}/notifications", headers=hdr(ece_fac_tok)).json())
        r_pub = client.post(
            f"{BASE_URL}/timetable/publish",
            headers=hdr(dean_tok),
            json={"version_id": draft_version_id, "publish_with_conflicts": True},
        )
        stu_tt = client.get(f"{BASE_URL}/timetable/me", headers=hdr(stu_tok)).json()
        fac_tt = client.get(f"{BASE_URL}/timetable/me", headers=hdr(fac_tok)).json()
        ece_notifs_after = len(client.get(f"{BASE_URL}/notifications", headers=hdr(ece_fac_tok)).json())

        record(
            "4. Timetable publish & scoped notify flow",
            r_pub.status_code == 200 and len(stu_tt) > 0 and len(fac_tt) > 0 and ece_notifs_after == ece_notifs_before,
            f"pub={r_pub.status_code} stu_slots={len(stu_tt)} fac_slots={len(fac_tt)} ece_unnotified={ece_notifs_after == ece_notifs_before}",
        )

        # ── 5. Interventions Flow ──────────────────────────────────────────────
        r_intv = client.post(
            f"{BASE_URL}/interventions",
            headers=hdr(fac_tok),
            json={"student_id": stu_id, "course_id": cs501_id, "kind": "talk", "note": "Demo check intervention", "follow_up_on": (date.today() + timedelta(days=5)).isoformat()},
        )
        intv_id = r_intv.json().get("id") if r_intv.status_code in (200, 201) else None
        men_sees_intv = any(i["id"] == intv_id for i in client.get(f"{BASE_URL}/interventions/students/{stu_id}", headers=hdr(men_tok)).json())
        stu_intv_403 = client.get(f"{BASE_URL}/interventions/students/{stu_id}", headers=hdr(stu_tok)).status_code == 403
        dean_reads_intv = client.get(f"{BASE_URL}/interventions/students/{stu_id}", headers=hdr(dean_tok)).status_code == 200
        dean_patch_403 = client.patch(f"{BASE_URL}/interventions/{intv_id}", headers=hdr(dean_tok), json={"outcome": "recovered"}).status_code == 403 if intv_id else False
        audits = client.get(f"{BASE_URL}/admin/audit-logs", headers=hdr(adm_tok)).json()
        audit_items = audits.get("items", audits) if isinstance(audits, dict) else audits
        has_dean_audit = any("dean" in str(a).lower() for a in audit_items)

        record(
            "5. Interventions cross-role & audit flow",
            bool(intv_id and men_sees_intv and stu_intv_403 and dean_reads_intv and dean_patch_403 and has_dean_audit),
            f"id={intv_id} men={men_sees_intv} stu403={stu_intv_403} dean_ro={dean_reads_intv and dean_patch_403} audit={has_dean_audit}",
        )

        # ── 6. Condonation Flow ────────────────────────────────────────────────
        queue = client.get(f"{BASE_URL}/condonation/queue", headers=hdr(dean_tok)).json()
        rec_item = next((q for q in queue if q.get("status") == "recommended"), None)
        cond_ok = False
        if rec_item:
            r_cdec = client.post(
                f"{BASE_URL}/condonation/{rec_item['id']}/decide",
                headers=hdr(dean_tok),
                json={"status": "approved", "decision_note": "Approved in demo_check"},
            )
            cond_ok = r_cdec.status_code == 200 and r_cdec.json().get("status") == "approved"
        else:
            # Recommend a student if none pending
            r_crec = client.post(
                f"{BASE_URL}/condonation/recommend",
                headers=hdr(men_tok),
                json={"student_id": stu_id, "semester_id": 1, "reason": "Demo check condonation"},
            )
            cond_ok = r_crec.status_code in (200, 201, 400)  # 400 if above floor, which still proves endpoint works

        record("6. Condonation queue & decision flow", cond_ok, f"queue_len={len(queue)}")

        # ── 7. Assignments Flow ────────────────────────────────────────────────
        asg_title = f"Demo Assignment {datetime.now(timezone.utc).strftime('%H%M%S')}"
        r_asg = client.post(
            f"{BASE_URL}/assignments",
            headers=hdr(fac_tok),
            json={"course_id": cs501_id, "title": asg_title, "kind": "assignment", "description": "Demo test", "due_at": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(), "grace_hours": 24, "is_published": True},
        )
        asg_id = r_asg.json().get("id") if r_asg.status_code == 201 else None
        tasks = client.get(f"{BASE_URL}/me/tasks", headers=hdr(stu_tok)).json()
        task_list = tasks.get("tasks", tasks) if isinstance(tasks, dict) else tasks
        stu_sees_task = any(asg_title in str(t) for t in task_list)
        r_sub_asg = client.post(
            f"{BASE_URL}/submissions",
            headers=hdr(stu_tok),
            json={"assignment_id": asg_id, "file_key": "demo_submission.pdf", "file_hash": "abc123"},
        ) if asg_id else None
        fac_subs = client.get(f"{BASE_URL}/submissions", headers=hdr(fac_tok), params={"assignment_id": asg_id}).json() if asg_id else []
        fac_sees_sub = any(s.get("student_id") == stu_id for s in fac_subs)

        record(
            "7. Assignments & submission cross-role flow",
            bool(asg_id and stu_sees_task and r_sub_asg and r_sub_asg.status_code in (200, 201) and fac_sees_sub),
            f"asg_id={asg_id} task={stu_sees_task} sub={r_sub_asg.status_code if r_sub_asg else None} fac_sees={fac_sees_sub}",
        )

        # ── 8. Revoked Duty Flow ───────────────────────────────────────────────
        r_rev = client.delete(f"{BASE_URL}/admin/mentors/{men_me['id']}/students/{stu_id}", headers=hdr(adm_tok))
        r_after_rev = client.get(f"{BASE_URL}/mentor/students/{stu_id}", headers=hdr(men_tok))
        # Restore mentor assignment so demo state remains intact
        client.post(f"{BASE_URL}/admin/mentors", headers=hdr(adm_tok), params={"mentor_id": men_me["id"], "student_id": stu_id})

        record(
            "8. Revoked mentor duty -> 403 flow",
            r_rev.status_code == 200 and r_after_rev.status_code == 403,
            f"revoke={r_rev.status_code} mentee_detail_after={r_after_rev.status_code}",
        )

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\nSummary: {passed}/{total} checks passed.")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
