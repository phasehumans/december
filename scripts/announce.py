#!/usr/bin/env python3
"""
Standard announcement and marketing email script for December.
Reads text template from scripts/announcement.txt and stylized HTML from scripts/announcement.html.
Sends to users in scripts/users.txt with exact December typography, colors, and layout.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TEMPLATE_PATH = os.path.join(BASE_DIR, "announcement.txt")
DEFAULT_HTML_PATH = os.path.join(BASE_DIR, "announcement.html")
DEFAULT_USERS_PATH = os.path.join(BASE_DIR, "users.txt")
DEFAULT_HISTORY_PATH = os.path.join(BASE_DIR, "announcement_history.json")
ENV_PATH = os.path.join(os.path.dirname(BASE_DIR), ".env")

SENDER = "December <team@trydecember.com>"
REPLY_TO = "team@trydecember.com"


def load_template(template_path):
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at: {template_path}")

    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read().strip()

    lines = content.split("\n")
    subject = ""
    body_lines = []

    for i, line in enumerate(lines):
        if i == 0 and line.lower().startswith("subject:"):
            subject = line[len("subject:"):].strip()
        elif i == 1 and not line.strip() and not body_lines:
            continue
        else:
            body_lines.append(line)

    body = "\n".join(body_lines).strip()
    return subject, body


def load_html_template(html_path):
    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""


def load_history(history_path):
    if os.path.exists(history_path):
        try:
            with open(history_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_history(history_path, history_data):
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=2)


def parse_users_file(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Users file not found at: {file_path}")

    users = []
    with open(file_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            # Format 1: "name, email"
            if "," in line:
                parts = [p.strip() for p in line.split(",")]
                name, email = parts[0], parts[1]
            # Format 2: "Name <email>"
            elif "<" in line and ">" in line:
                name_part, email_part = line.split("<", 1)
                name = name_part.strip()
                email = email_part.replace(">", "").strip()
            # Format 3: simple email "email@example.com"
            else:
                email = line
                prefix = email.split("@")[0].replace(".", " ").replace("_", " ").split()[0] if "@" in email else "there"
                if any(char.isdigit() for char in prefix) or len(prefix) > 12:
                    name = "there"
                else:
                    name = prefix

            users.append({
                "email": email.strip(),
                "name": name.strip().lower(),
            })

    return users


def send_single_email(api_key, to_email, subject, body, html=None):
    payload = {
        "from": SENDER,
        "to": [to_email],
        "reply_to": REPLY_TO,
        "subject": subject,
        "text": body,
    }
    if html:
        payload["html"] = html

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="December Announcement Engine")
    parser.add_argument("--template", default=DEFAULT_TEMPLATE_PATH, help="Path to text announcement template")
    parser.add_argument("--html", default=DEFAULT_HTML_PATH, help="Path to stylized HTML announcement template")
    parser.add_argument("--no-html", action="store_true", help="Send plain text only")
    parser.add_argument("--users", help="Path to users.txt file")
    parser.add_argument("--test", help="Send a single test email to this address")
    parser.add_argument("--delay", type=int, default=20, help="Delay in seconds between emails (default: 20s)")
    parser.add_argument("--send", action="store_true", help="Send live emails (default is dry-run)")
    parser.add_argument("--force", action="store_true", help="Send even if email is in history")

    args = parser.parse_args()

    env = dotenv.dotenv_values(ENV_PATH)
    api_key = env.get("RESEND_API_KEY")
    if not api_key:
        print("Error: RESEND_API_KEY not found in .env")
        sys.exit(1)

    subject_template, body_template = load_template(args.template)
    html_raw = "" if args.no_html else load_html_template(args.html)
    history = load_history(DEFAULT_HISTORY_PATH)

    recipients = []
    if args.test:
        recipients.append({
            "email": args.test.strip(),
            "name": "tester",
        })
    else:
        users_path = args.users or (DEFAULT_USERS_PATH if os.path.exists(DEFAULT_USERS_PATH) else "users.txt")
        recipients = parse_users_file(users_path)

    print(f"Loaded {len(recipients)} recipient(s).")
    print(f"Text Template: {args.template}")
    print(f"HTML Template: {'Enabled (' + args.html + ')' if html_raw else 'Disabled (Plain text only)'}")
    print(f"Subject: {subject_template}")
    print(f"Mode: {'LIVE BROADCAST' if args.send else 'DRY RUN'}")
    print(f"Delay: {args.delay}s\n")

    for i, r in enumerate(recipients):
        email = r["email"]
        name = r["name"].lower() if r["name"] else "there"

        history_key = f"{email}::{subject_template}"
        if history_key in history and not args.force and not args.test:
            print(f"[{i+1}/{len(recipients)}] SKIPPED (already received this announcement): {email}")
            continue

        body = body_template.replace("{name}", name)
        html = (
            html_raw.replace("{name}", name).replace("{subject}", subject_template)
            if html_raw
            else None
        )

        if not args.send:
            print(f"[{i+1}/{len(recipients)}] [DRY-RUN] To: {name} <{email}>")
            print(f"  First line: {body.splitlines()[0]}")
            if html:
                print(f"  HTML payload: {len(html)} bytes with exact December typography & styling")
            print("-" * 50)
        else:
            print(f"[{i+1}/{len(recipients)}] Sending to {name} <{email}>...", flush=True)
            try:
                res = send_single_email(api_key, email, subject_template, body, html=html)
                email_id = res.get("id")
                history[history_key] = {
                    "email": email,
                    "name": name,
                    "subject": subject_template,
                    "id": email_id,
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                save_history(DEFAULT_HISTORY_PATH, history)
                print(f"      Sent! (ID: {email_id})", flush=True)
            except Exception as e:
                print(f"      ERROR sending to {email}: {e}", flush=True)

            if i < len(recipients) - 1:
                print(f"      Waiting {args.delay}s before next send...", flush=True)
                time.sleep(args.delay)

    print("\nAnnouncement broadcast completed!")


if __name__ == "__main__":
    main()
