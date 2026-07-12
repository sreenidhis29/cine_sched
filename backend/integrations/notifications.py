import resend
import logging
from config import settings

logger = logging.getLogger(__name__)

# Initialize Resend
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

def send_email(to: str, subject: str, html_body: str):
    if not settings.RESEND_API_KEY:
        logger.warning(f"Resend API key not set. Mocking email to {to}:\nSubject: {subject}\nBody: {html_body}")
        return True

    try:
        r = resend.Emails.send({
            "from": "CineSched <noreply@cinesched.com>", # Note: This needs a verified domain on Resend in production
            "to": to,
            "subject": subject,
            "html": html_body
        })
        logger.info(f"Sent email to {to}, ID: {r.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False

def send_invite_email(to_email: str, org_name: str, invite_link: str):
    subject = f"You've been invited to join {org_name} on CineSched"
    html = f"""
    <h2>Welcome to CineSched!</h2>
    <p>You have been invited to join the organization <strong>{org_name}</strong>.</p>
    <p><a href="{invite_link}">Click here to accept the invitation and set up your account</a></p>
    """
    return send_email(to_email, subject, html)

def send_approval_request_email(to_email: str, project_name: str, threshold_reason: str, approval_link: str):
    subject = f"Action Required: Schedule Approval for {project_name}"
    html = f"""
    <h2>Schedule Pending Approval</h2>
    <p>The scheduling pipeline for <strong>{project_name}</strong> has generated a feasible schedule, but it requires manual approval.</p>
    <p><strong>Reason:</strong> {threshold_reason}</p>
    <p><a href="{approval_link}">Review and Approve Schedule</a></p>
    """
    return send_email(to_email, subject, html)

def send_schedule_finalized_email(to_email: str, project_name: str, schedule_link: str):
    subject = f"Schedule Finalized for {project_name}"
    html = f"""
    <h2>Schedule Finalized</h2>
    <p>The shooting schedule for <strong>{project_name}</strong> has been finalized and approved.</p>
    <p><a href="{schedule_link}">View the Final Schedule</a></p>
    """
    return send_email(to_email, subject, html)
