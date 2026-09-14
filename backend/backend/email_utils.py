"""
backend/email_utils.py

Small wrapper around Brevo's (formerly Sendinblue) transactional email
HTTP API (https://api.brevo.com/v3/smtp/email).

Why this exists:
    The project previously relied on Django's SMTP email backend
    (Gmail + an app password) via django.core.mail.send_mail(). That
    setup is fragile in this environment (no valid app password
    configured, Gmail's SMTP is often blocked on hosting providers,
    etc.), so "Create User & Send Email" on the admin Users page was
    silently failing.

    Brevo's API sends email over plain HTTPS (port 443) using an API
    key, so it doesn't depend on SMTP ports being open or an app
    password being set up correctly.

Setup:
    1. Create a free Brevo account: https://www.brevo.com/
    2. Generate an API key: SMTP & API > API Keys > Generate a new API key
    3. Add to your .env file (same folder as manage.py's parent, i.e.
       backend/.env):

        BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        BREVO_SENDER_EMAIL=seekandbalik@gmail.com
        BREVO_SENDER_NAME=SLC Seek & Balik

    4. The sender email must be a verified sender in your Brevo account
       (Senders, Domains & Dedicated IPs > Senders).

Usage:
    from backend.email_utils import send_brevo_email

    send_brevo_email(
        to_email="student@example.com",
        to_name="Juan Dela Cruz",
        subject="Your account password",
        text_content="Plain text body",
        html_content="<p>Optional HTML body</p>",  # optional
    )
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class BrevoEmailError(Exception):
    """Raised when Brevo's API rejects or fails to send an email."""


def send_brevo_email(to_email, subject, text_content, to_name=None, html_content=None):
    """
    Send a single transactional email through Brevo's HTTP API.

    Returns True on success. Raises BrevoEmailError on failure so
    callers can decide whether to swallow the error (fail_silently
    style) or surface it to the user.
    """
    api_key = getattr(settings, "BREVO_API_KEY", "")
    sender_email = getattr(settings, "BREVO_SENDER_EMAIL", "")
    sender_name = getattr(settings, "BREVO_SENDER_NAME", "SLC Seek & Balik")

    if not api_key:
        raise BrevoEmailError(
            "BREVO_API_KEY is not configured. Add it to your .env file."
        )

    if not sender_email:
        raise BrevoEmailError(
            "BREVO_SENDER_EMAIL is not configured. Add it to your .env file."
        )

    if not to_email:
        raise BrevoEmailError("Missing recipient email address.")

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, "name": to_name or to_email}],
        "subject": subject,
        "textContent": text_content,
    }

    if html_content:
        payload["htmlContent"] = html_content

    request = urllib.request.Request(
        BREVO_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
            logger.info("Brevo email sent to %s (subject=%r)", to_email, subject)
            return True
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.error(
            "Brevo API rejected email to %s: %s %s", to_email, exc.code, error_body
        )
        raise BrevoEmailError(f"Brevo API error {exc.code}: {error_body}") from exc
    except urllib.error.URLError as exc:
        logger.error("Could not reach Brevo API for email to %s: %s", to_email, exc)
        raise BrevoEmailError(f"Could not reach Brevo API: {exc.reason}") from exc
