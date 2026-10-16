"""
Input and Output Sanitization Utility for AcadFlow.

Provides contextual output encoding to mitigate Cross-Site Scripting (XSS).
Ensures raw user input is safely encoded when rendered in HTML contexts.
"""

import html
from typing import Any, Dict, List


def escape_html(text: Any) -> str:
    """
    Safely encode HTML special characters (&, <, >, ", ').
    """
    if text is None:
        return ""
    return html.escape(str(text), quote=True)


def sanitize_payload(data: Any) -> Any:
    """
    Recursively escape string fields in dictionaries or lists.
    """
    if isinstance(data, str):
        return escape_html(data)
    elif isinstance(data, dict):
        return {k: sanitize_payload(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_payload(item) for item in data]
    return data
