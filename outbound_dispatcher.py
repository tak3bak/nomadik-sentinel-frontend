#!/usr/bin/env python3
import os
import sys
import json
import time
import requests
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
SENDER_NAME = os.getenv("SENDER_NAME", "Kalen | Nomadik Security")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "kalen@nomadik.site")
REPLY_TO = os.getenv("REPLY_TO", "kalen@nomadik.site")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_ACCOUNT_URL = "https://api.brevo.com/v3/account"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

LEDGER_FILE = "outreach_ledger.json"

def load_ledger() -> Dict[str, dict]:
    if os.path.exists(LEDGER_FILE):
        try:
            with open(LEDGER_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Warning: Failed to parse {LEDGER_FILE}: {e}. Creating new ledger.")
            return {}
    return {}

def save_ledger(ledger: Dict[str, dict]) -> None:
    with open(LEDGER_FILE, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2)

def verify_brevo_connection() -> bool:
    if not BREVO_API_KEY:
        print("[-] ERROR: BREVO_API_KEY is not set in environment or .env file.")
        return False

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY
    }

    try:
        response = requests.get(BREVO_ACCOUNT_URL, headers=headers, timeout=10)
        if response.status_code == 200:
            account_data = response.json()
            email = account_data.get("email", "Unknown")
            print(f"[+] Brevo authentication successful for account: {email}")
            return True
        elif response.status_code == 401:
            print("[-] ERROR: Brevo API authentication failed (401 Unauthorized / Key not found).")
            print("    Ensure you use a v3 REST API Key (starts with xkeysib-), not an SMTP password.")
            return False
        else:
            print(f"[-] Brevo connection check returned status {response.status_code}: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[-] Network error connecting to Brevo: {e}")
        return False

def synthesize_pitch_groq(lead: dict) -> Optional[Dict[str, str]]:
    if not GROQ_API_KEY:
        print("[-] ERROR: GROQ_API_KEY is missing. Cannot synthesize pitches.")
        return None

    company = lead.get("company_name", "your company")
    contact_name = lead.get("contact_name", "there")
    audit_finding = lead.get("audit_finding", "exposed perimeter services and missing DNS security headers")

    prompt = f"""
You are Kalen from Nomadik Security Operations. Write a high-conversion, 3-to-4 sentence cold outreach email to {contact_name} at {company}.

Context:
- We completed an external perimeter scan and identified: {audit_finding}.
- Tone: technical, helpful, peer-to-peer (lead security engineer), not spammy sales jargon.
- Call to Action: Offer a free 2-page remediation brief or a 10-minute technical debrief.

Return ONLY a valid JSON object in this exact format, with no surrounding markdown:
{{
  "subject": "Quick perimeter audit note for {company}",
  "body": "Hi {contact_name},\\n\\n..."
}}
"""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "gemma2-9b-it",
        "messages": [
            {"role": "system", "content": "You are a professional security engineer writing targeted B2B outreach. Output strictly raw JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.4,
        "max_tokens": 500
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=20)
        if response.status_code != 200:
            print(f"[-] Groq API error ({response.status_code}): {response.text}")
            return None

        result = response.json()
        content = result["choices"][0]["message"]["content"].strip()

        if content.startswith("```json"):
            content = content.replace("```json", "", 1)
        if content.startswith("```"):
            content = content.replace("```", "", 1)
        if content.endswith("```"):
            content = content[:-3]

        parsed = json.loads(content.strip())
        return {
            "subject": parsed.get("subject", f"Perimeter security observation for {company}"),
            "body": parsed.get("body", "")
        }
    except Exception as e:
        print(f"[-] Failed to generate pitch via Groq for {company}: {e}")
        return None

def send_brevo_transactional_email(recipient_email: str, recipient_name: str, subject: str, body_text: str) -> Optional[str]:
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }

    html_content = "".join([f"<p>{p.strip()}</p>" for p in body_text.split("\n\n") if p.strip()])

    payload = {
        "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
        "to": [{"email": recipient_email, "name": recipient_name}],
        "replyTo": {"email": REPLY_TO, "name": SENDER_NAME},
        "subject": subject,
        "htmlContent": html_content,
        "textContent": body_text
    }

    try:
        response = requests.post(BREVO_API_URL, headers=headers, json=payload, timeout=15)
        if response.status_code in [200, 201]:
            resp_data = response.json()
            return resp_data.get("messageId", "DISPATCHED")
        elif response.status_code == 401:
            print("[-] Authentication Failure (401): Brevo rejected the API key.")
        elif response.status_code == 402:
            print("[-] Payment/Quota Required (402): Brevo daily sending limit reached.")
        else:
            print(f"[-] Brevo dispatch failed ({response.status_code}): {response.text}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[-] Network error dispatching to {recipient_email}: {e}")
        return None

def run_campaign(leads: List[dict], delay_seconds: int = 15) -> None:
    if not verify_brevo_connection():
        print("[-] Halting campaign execution due to Brevo authentication failure.")
        return

    ledger = load_ledger()
    total_leads = len(leads)
    sent_count = 0

    print(f"\n[*] Starting outbound campaign. Processing {total_leads} leads...")

    for idx, lead in enumerate(leads, start=1):
        email = lead.get("email", "").strip().lower()
        company = lead.get("company_name", "Target Company")
        contact_name = lead.get("contact_name", "Decision Maker")

        if not email:
            print(f"[{idx}/{total_leads}] Skipping invalid lead entry with no email.")
            continue

        if email in ledger and ledger[email].get("status") == "SENT":
            print(f"[{idx}/{total_leads}] Skipping {email} ({company}) - already sent on {ledger[email].get('timestamp')}.")
            continue

        print(f"\n[{idx}/{total_leads}] Synthesizing pitch for {contact_name} @ {company} ({email})...")
        pitch = synthesize_pitch_groq(lead)

        if not pitch or not pitch.get("body"):
            print(f"[-] Failed to generate pitch for {email}. Skipping.")
            continue

        print(f"[*] Dispatching via Brevo: \"{pitch['subject']}\"")
        message_id = send_brevo_transactional_email(
            recipient_email=email,
            recipient_name=contact_name,
            subject=pitch["subject"],
            body_text=pitch["body"]
        )

        if message_id:
            print(f"[+] Successfully sent to {email}! Message ID: {message_id}")
            ledger[email] = {
                "status": "SENT",
                "message_id": message_id,
                "company": company,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                "subject": pitch["subject"]
            }
            save_ledger(ledger)
            sent_count += 1
        else:
            print(f"[-] Failed to dispatch to {email}.")
            ledger[email] = {
                "status": "FAILED",
                "company": company,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
            }
            save_ledger(ledger)

        if idx < total_leads:
            print(f"[*] Throttling for {delay_seconds} seconds...")
            time.sleep(delay_seconds)

    print(f"\n[✓] Campaign cycle complete. Dispatched {sent_count}/{total_leads} emails.")

if __name__ == "__main__":
    sample_leads = [
        {
            "contact_name": "Security Lead",
            "company_name": "Nomadik Internal Test",
            "email": "kalen.vandenbos@gmail.com",
            "audit_finding": "exposed administrative port 8080 and missing HSTS security header"
        }
    ]
    print("--- Nomadik Security Lead Dispatcher Test ---")
    run_campaign(sample_leads, delay_seconds=5)
