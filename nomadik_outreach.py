import os
import requests
from groq import Groq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
BREVO_API_KEY = os.environ.get("BREVO_API_KEY")

# Using Groq's universally available foundational model
GROQ_MODEL = "llama3-8b-8192" 
SENDER_EMAIL = "kalen@nomadik.site" 
SENDER_NAME = "Kalen Vandenbos"

def generate_pitch(company_name, risk_score, ssl_status):
    if not GROQ_API_KEY:
        print("Error: GROQ_API_KEY environment variable is missing.")
        return None
        
    client = Groq(api_key=GROQ_API_KEY)
    
    prompt = f"""
    You are Kalen Vandenbos, Lead Security Engineer at Nomadik Security Operations.
    Write a concise, highly technical cold outreach email to {company_name}.
    We just completed a passive perimeter audit on their infrastructure. 
    Include the following diagnostic data naturally:
    - Risk Score: {risk_score}/100
    - SSL Status: {ssl_status}
    
    Tone: Professional, urgent, but not alarmist. No fluff. 
    Call to action: A 15-minute technical review of the audit findings.
    """

    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a technical cybersecurity expert writing B2B outreach."},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.4,
            max_tokens=500,
        )
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        print(f"Groq API Error generating pitch for {company_name}: {e}")
        return None

def send_email(target_email, company_name, email_body):
    if not BREVO_API_KEY:
        print("Error: BREVO_API_KEY environment variable is missing.")
        return False

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    payload = {
        "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
        "to": [{"email": target_email}],
        "subject": f"Security Perimeter Audit Results: {company_name}",
        "textContent": email_body
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        print(f"Success! Email dispatched to {target_email} via Brevo.")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Brevo API Error sending to {target_email}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response details: {e.response.text}")
        return False

def main():
    targets = [
        {"name": "Titanium Defense", "email": "security@example.com", "risk_score": 78, "ssl_status": "Expiring in 14 days"},
        {"name": "Vertex Energy", "email": "admin@example.com", "risk_score": 82, "ssl_status": "TLS 1.1 Detected (Deprecated)"}
    ]

    print("Initializing Nomadik Security Sentinel Outreach Pipeline (Brevo Edition)...")
    
    for target in targets:
        print(f"\nProcessing {target['name']}...")
        
        pitch = generate_pitch(target["name"], target["risk_score"], target["ssl_status"])
        
        if pitch:
            print("Pitch synthesized successfully. Dispatching via Brevo...")
            send_email(target["email"], target["name"], pitch)
        else:
            print(f"Skipping {target['name']} due to AI generation failure.")

if __name__ == "__main__":
    main()
