"""
Rule-based date and deadline extraction service — AcadFlow Phase 7.

Extracts dates, times, deadlines and event milestones from notice text and links.
Timezone: Asia/Kolkata (IST, UTC+05:30).
"""

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List
import zoneinfo

TZ_IST = zoneinfo.ZoneInfo("Asia/Kolkata")

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

DAYS_OF_WEEK = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

DEADLINE_KEYWORDS = ["deadline", "due", "submit", "submission", "last date", "register by", "registration closes", "cutoff", "before"]
EVENT_KEYWORDS = ["event", "hackathon", "workshop", "webinar", "exam", "test", "orientation", "symposium", "conference"]


def extract_dates(text: str) -> List[Dict[str, Any]]:
    """
    Rule-based extraction of dates in Asia/Kolkata timezone.
    Returns list of candidate deadlines/events with plain-text explanations.
    """
    if not text:
        return []

    now_ist = datetime.now(TZ_IST)
    current_year = now_ist.year
    candidates: List[Dict[str, Any]] = []

    text_lower = text.lower()

    # Pattern 1: DD Month YYYY (e.g. 28 Nov 2026, 15 October 2026)
    p1 = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?(?:[,\s]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b", re.IGNORECASE)
    for m in p1.finditer(text):
        day_str, month_str, year_str, hour_str, min_str, ampm_str = m.groups()
        m_lower = month_str.lower()
        if m_lower in MONTHS:
            try:
                day = int(day_str)
                month = MONTHS[m_lower]
                year = int(year_str) if year_str else current_year
                hour = int(hour_str) if hour_str else 23
                minute = int(min_str) if min_str else 59
                if ampm_str:
                    if ampm_str.lower() == "pm" and hour < 12:
                        hour += 12
                    elif ampm_str.lower() == "am" and hour == 12:
                        hour = 0

                dt = datetime(year, month, day, hour, minute, tzinfo=TZ_IST)

                # Classify kind
                surrounding = text_lower[max(0, m.start() - 40):min(len(text), m.end() + 40)]
                is_deadline = any(kw in surrounding for kw in DEADLINE_KEYWORDS)
                is_event = any(kw in surrounding for kw in EVENT_KEYWORDS)

                kind = "deadline" if is_deadline else ("event" if is_event else "deadline")
                label = f"{'Submission deadline' if kind == 'deadline' else 'Event date'}: {dt.strftime('%d %b %Y, %H:%M')}"

                candidates.append({
                    "raw": m.group(0),
                    "at": dt.isoformat(),
                    "kind": kind,
                    "label": label,
                    "confidence": 0.95,
                    "source": "detected",
                })
            except Exception:
                continue

    # Pattern 2: YYYY-MM-DD (ISO)
    p2 = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
    for m in p2.finditer(text):
        try:
            year, month, day = map(int, m.groups())
            dt = datetime(year, month, day, 23, 59, tzinfo=TZ_IST)
            candidates.append({
                "raw": m.group(0),
                "at": dt.isoformat(),
                "kind": "deadline",
                "label": f"Deadline: {dt.strftime('%d %b %Y, 23:59')}",
                "confidence": 0.9,
                "source": "detected",
            })
        except Exception:
            continue

    # Pattern 3: Relative (e.g. "by next Friday", "due this Friday", "tomorrow")
    p3 = re.compile(r"\b(by\s+|due\s+)?(this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b", re.IGNORECASE)
    for m in p3.finditer(text):
        prefix, qualifier, day_or_rel = m.groups()
        day_lower = day_or_rel.lower()
        if day_lower == "tomorrow":
            target_date = now_ist + timedelta(days=1)
            target_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59, tzinfo=TZ_IST)
            candidates.append({
                "raw": m.group(0),
                "at": target_dt.isoformat(),
                "kind": "deadline",
                "label": f"Deadline: Tomorrow ({target_dt.strftime('%d %b %Y')})",
                "confidence": 0.85,
                "source": "detected",
            })
        elif day_lower in DAYS_OF_WEEK:
            target_dow = DAYS_OF_WEEK[day_lower]
            current_dow = now_ist.weekday()
            days_ahead = (target_dow - current_dow) % 7
            if days_ahead == 0 or (qualifier and qualifier.lower() == "next"):
                days_ahead += 7
            target_date = now_ist + timedelta(days=days_ahead)
            target_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59, tzinfo=TZ_IST)
            candidates.append({
                "raw": m.group(0),
                "at": target_dt.isoformat(),
                "kind": "deadline",
                "label": f"Deadline: {day_lower.capitalize()} ({target_dt.strftime('%d %b %Y')})",
                "confidence": 0.8,
                "source": "detected",
            })

    # Deduplicate by ISO timestamp
    seen = set()
    unique_candidates = []
    for c in candidates:
        if c["at"] not in seen:
            seen.add(c["at"])
            unique_candidates.append(c)

    return unique_candidates
