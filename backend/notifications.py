# Notification Service for Calendrax
# Supports Email (SendGrid), SMS (Twilio), and WhatsApp (Twilio) notifications

import os
import logging
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from twilio.rest import Client as TwilioClient

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@bookle.app')

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER')
# WhatsApp number - stored WITHOUT 'whatsapp:' prefix, added when sending
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '').replace('whatsapp:', '')

# Feature flags - enable/disable notifications
EMAIL_ENABLED = bool(SENDGRID_API_KEY)
SMS_ENABLED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)
WHATSAPP_ENABLED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_NUMBER)


# ==================== EMAIL SERVICE ====================

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send an email using SendGrid
    
    Args:
        to_email: Recipient email address
        subject: Email subject line
        html_content: HTML content of the email
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    if not EMAIL_ENABLED:
        logger.warning("Email notifications disabled - SENDGRID_API_KEY not configured")
        return False
    
    try:
        message = Mail(
            from_email=SENDGRID_FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        
        if response.status_code == 202:
            logger.info(f"Email sent successfully to {to_email}")
            return True
        else:
            logger.error(f"Email failed with status {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


# ==================== PHONE NUMBER UTILITIES ====================

def format_phone_number(phone: str) -> str:
    """
    Format phone number to E.164 format for Twilio
    
    Args:
        phone: Phone number in various formats
    
    Returns:
        str: Phone number in E.164 format (e.g., +447531848298)
    """
    # Remove any spaces, dashes, or parentheses
    phone = ''.join(c for c in phone if c.isdigit() or c == '+')
    
    # If already starts with +, return as is
    if phone.startswith('+'):
        return phone
    
    # If starts with 00, replace with +
    if phone.startswith('00'):
        return '+' + phone[2:]
    
    # UK specific: if starts with 0, assume UK and convert to +44
    if phone.startswith('0'):
        return '+44' + phone[1:]
    
    # Otherwise, assume it's already without country code, default to UK
    return '+44' + phone


# ==================== SMS SERVICE ====================

def send_sms(to_number: str, message: str) -> bool:
    """
    Send an SMS using Twilio
    
    Args:
        to_number: Recipient phone number (E.164 format, e.g., +44123456789)
        message: SMS message content
    
    Returns:
        bool: True if SMS was sent successfully, False otherwise
    """
    if not SMS_ENABLED:
        logger.warning("SMS notifications disabled - Twilio credentials not configured")
        return False
    
    try:
        client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        # Format the phone number to E.164
        formatted_number = format_phone_number(to_number)
        
        sms = client.messages.create(
            body=message,
            from_=TWILIO_FROM_NUMBER,
            to=formatted_number
        )
        
        logger.info(f"SMS sent successfully to {formatted_number}, SID: {sms.sid}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send SMS to {to_number}: {str(e)}")
        return False


# ==================== WHATSAPP SERVICE ====================

# Twilio Content Template SIDs
WHATSAPP_TEMPLATE_APPOINTMENT_CONFIRMATION = "HXfd8de220f8c35ad016d0a898da95423a"

def send_whatsapp(to_number: str, message: str) -> bool:
    """
    Send a WhatsApp message using Twilio (plain text - for sandbox/testing)
    
    Args:
        to_number: Recipient phone number (E.164 format, e.g., +44123456789)
        message: WhatsApp message content
    
    Returns:
        bool: True if WhatsApp was sent successfully, False otherwise
    
    Note: For Twilio Sandbox, the recipient must have joined the sandbox by
    sending 'join <sandbox-keyword>' to the Twilio WhatsApp number first.
    """
    if not WHATSAPP_ENABLED:
        logger.warning("WhatsApp notifications disabled - Twilio credentials not configured")
        return False
    
    try:
        client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        # Format the phone number to E.164
        formatted_number = format_phone_number(to_number)
        
        # Format the 'to' number for WhatsApp
        whatsapp_to = f"whatsapp:{formatted_number}" if not formatted_number.startswith("whatsapp:") else formatted_number
        
        wa_message = client.messages.create(
            body=message,
            from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
            to=whatsapp_to
        )
        
        logger.info(f"WhatsApp sent successfully to {formatted_number}, SID: {wa_message.sid}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {to_number}: {str(e)}")
        return False


def send_whatsapp_template(to_number: str, template_sid: str, template_variables: dict) -> bool:
    """
    Send a WhatsApp message using a Twilio Content Template
    
    Args:
        to_number: Recipient phone number (E.164 format)
        template_sid: The Twilio Content Template SID (e.g., HXxxxx)
        template_variables: Dictionary of template variables (e.g., {"1": "John", "2": "Jan 15"})
    
    Returns:
        bool: True if WhatsApp was sent successfully, False otherwise
    """
    if not WHATSAPP_ENABLED:
        logger.warning("WhatsApp notifications disabled - Twilio credentials not configured")
        return False
    
    try:
        client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        # Format the phone number to E.164
        formatted_number = format_phone_number(to_number)
        
        # Format the 'to' number for WhatsApp
        whatsapp_to = f"whatsapp:{formatted_number}" if not formatted_number.startswith("whatsapp:") else formatted_number
        whatsapp_from = f"whatsapp:{TWILIO_WHATSAPP_NUMBER}" if not TWILIO_WHATSAPP_NUMBER.startswith("whatsapp:") else TWILIO_WHATSAPP_NUMBER
        
        import json
        wa_message = client.messages.create(
            content_sid=template_sid,
            content_variables=json.dumps(template_variables),
            from_=whatsapp_from,
            to=whatsapp_to
        )
        
        logger.info(f"WhatsApp template sent successfully to {formatted_number}, SID: {wa_message.sid}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send WhatsApp template to {to_number}: {str(e)}")
        return False


def send_appointment_confirmation_whatsapp(to_number: str, first_name: str, date: str, time: str) -> bool:
    """
    Send appointment confirmation via WhatsApp using the approved template
    
    Args:
        to_number: Customer's phone number
        first_name: Customer's first name
        date: Appointment date (e.g., "15th January 2025")
        time: Appointment time (e.g., "3:00 PM")
    
    Returns:
        bool: True if sent successfully
    """
    template_variables = {
        "first_name": first_name,
        "date": date,
        "time": time
    }
    
    return send_whatsapp_template(
        to_number=to_number,
        template_sid=WHATSAPP_TEMPLATE_APPOINTMENT_CONFIRMATION,
        template_variables=template_variables
    )


# ==================== EMAIL TEMPLATES ====================

def get_booking_created_email(
    business_name: str,
    customer_name: str,
    service_name: str,
    date: str,
    time: str
) -> tuple[str, str]:
    """Returns (subject, html_content) for booking created notification"""
    subject = f"New Booking Request - {service_name}"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 10px; padding: 30px;">
            <h1 style="color: #a3e635; margin-bottom: 20px;">New Booking Request</h1>
            <p>Hello {business_name},</p>
            <p>You have received a new booking request:</p>
            <div style="background-color: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong style="color: #a3e635;">Customer:</strong> {customer_name}</p>
                <p><strong style="color: #a3e635;">Service:</strong> {service_name}</p>
                <p><strong style="color: #a3e635;">Date:</strong> {date}</p>
                <p><strong style="color: #a3e635;">Time:</strong> {time}</p>
            </div>
            <p>Please log in to your Calendrax dashboard to approve or decline this request.</p>
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Calendrax.</p>
        </div>
    </body>
    </html>
    """
    return subject, html_content


def get_booking_approved_email(
    customer_name: str,
    business_name: str,
    service_name: str,
    date: str,
    time: str
) -> tuple[str, str]:
    """Returns (subject, html_content) for booking approved notification"""
    subject = f"Booking Confirmed - {service_name} at {business_name}"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 10px; padding: 30px;">
            <h1 style="color: #a3e635; margin-bottom: 20px;">Booking Confirmed!</h1>
            <p>Hello {customer_name},</p>
            <p>Great news! Your booking has been confirmed:</p>
            <div style="background-color: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong style="color: #a3e635;">Business:</strong> {business_name}</p>
                <p><strong style="color: #a3e635;">Service:</strong> {service_name}</p>
                <p><strong style="color: #a3e635;">Date:</strong> {date}</p>
                <p><strong style="color: #a3e635;">Time:</strong> {time}</p>
            </div>
            <p>We look forward to seeing you!</p>
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Calendrax.</p>
        </div>
    </body>
    </html>
    """
    return subject, html_content


def get_booking_declined_email(
    customer_name: str,
    business_name: str,
    service_name: str,
    date: str,
    time: str
) -> tuple[str, str]:
    """Returns (subject, html_content) for booking declined notification"""
    subject = f"Booking Update - {service_name} at {business_name}"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 10px; padding: 30px;">
            <h1 style="color: #ef4444; margin-bottom: 20px;">Booking Not Available</h1>
            <p>Hello {customer_name},</p>
            <p>Unfortunately, your booking request could not be accommodated:</p>
            <div style="background-color: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong style="color: #a3e635;">Business:</strong> {business_name}</p>
                <p><strong style="color: #a3e635;">Service:</strong> {service_name}</p>
                <p><strong style="color: #a3e635;">Date:</strong> {date}</p>
                <p><strong style="color: #a3e635;">Time:</strong> {time}</p>
            </div>
            <p>Please try booking a different time slot or contact the business directly.</p>
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Calendrax.</p>
        </div>
    </body>
    </html>
    """
    return subject, html_content


def get_booking_cancelled_email(
    business_name: str,
    customer_name: str,
    service_name: str,
    date: str,
    time: str
) -> tuple[str, str]:
    """Returns (subject, html_content) for booking cancelled notification"""
    subject = f"Booking Cancelled - {service_name}"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 10px; padding: 30px;">
            <h1 style="color: #f59e0b; margin-bottom: 20px;">Booking Cancelled</h1>
            <p>Hello {business_name},</p>
            <p>A booking has been cancelled:</p>
            <div style="background-color: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong style="color: #a3e635;">Customer:</strong> {customer_name}</p>
                <p><strong style="color: #a3e635;">Service:</strong> {service_name}</p>
                <p><strong style="color: #a3e635;">Date:</strong> {date}</p>
                <p><strong style="color: #a3e635;">Time:</strong> {time}</p>
            </div>
            <p>The time slot is now available for other bookings.</p>
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Calendrax.</p>
        </div>
    </body>
    </html>
    """
    return subject, html_content


# ==================== SMS TEMPLATES ====================

def get_booking_created_sms(customer_name: str, service_name: str, date: str, time: str) -> str:
    """Returns SMS message for booking created notification"""
    return f"Calendrax: New booking request from {customer_name} for {service_name} on {date} at {time}. Log in to approve/decline."


def get_booking_approved_sms(business_name: str, service_name: str, date: str, time: str) -> str:
    """Returns SMS message for booking approved notification"""
    return f"Calendrax: Your booking at {business_name} for {service_name} on {date} at {time} is confirmed!"


def get_booking_declined_sms(business_name: str, service_name: str, date: str, time: str) -> str:
    """Returns SMS message for booking declined notification"""
    return f"Calendrax: Unfortunately your booking at {business_name} for {service_name} on {date} at {time} could not be accommodated."


def get_booking_cancelled_sms(customer_name: str, service_name: str, date: str, time: str) -> str:
    """Returns SMS message for booking cancelled notification"""
    return f"Calendrax: {customer_name} cancelled their booking for {service_name} on {date} at {time}."


# ==================== WHATSAPP TEMPLATES ====================

def get_booking_created_whatsapp(customer_name: str, service_name: str, date: str, time: str) -> str:
    """Returns WhatsApp message for new booking notification to business owner"""
    return f"""📅 *New Booking Request*

Customer: *{customer_name}*
Service: *{service_name}*
Date: *{date}*
Time: *{time}*

Log in to your Calendrax dashboard to approve or decline."""


def get_booking_approved_whatsapp(business_name: str, service_name: str, date: str, time: str) -> str:
    """Returns WhatsApp message for booking approved notification to customer"""
    return f"""✅ *Booking Confirmed!*

Your appointment at *{business_name}* has been confirmed:

Service: *{service_name}*
Date: *{date}*
Time: *{time}*

We look forward to seeing you!"""


def get_booking_declined_whatsapp(business_name: str, service_name: str, date: str, time: str) -> str:
    """Returns WhatsApp message for booking declined notification to customer"""
    return f"""❌ *Booking Not Available*

Unfortunately, your booking request at *{business_name}* could not be accommodated:

Service: *{service_name}*
Date: *{date}*
Time: *{time}*

Please try booking a different time slot."""


def get_booking_cancelled_whatsapp(customer_name: str, service_name: str, date: str, time: str) -> str:
    """Returns WhatsApp message for booking cancelled notification to business owner"""
    return f"""🚫 *Booking Cancelled*

*{customer_name}* has cancelled their booking:

Service: *{service_name}*
Date: *{date}*
Time: *{time}*

The time slot is now available for other bookings."""


def get_booking_reminder_whatsapp(business_name: str, service_name: str, date: str, time: str) -> str:
    """Returns WhatsApp message for appointment reminder to customer"""
    return f"""⏰ *Appointment Reminder*

Don't forget your upcoming appointment at *{business_name}*:

Service: *{service_name}*
Date: *{date}*
Time: *{time}*

See you soon!"""


# ==================== NOTIFICATION DISPATCHER ====================

async def notify_booking_created(
    business_owner_email: str,
    business_owner_phone: Optional[str],
    business_name: str,
    customer_name: str,
    service_name: str,
    date: str,
    time: str,
    email_enabled: bool = True,
    whatsapp_enabled: bool = True
):
    """Send notifications when a new booking is created"""
    results = {"email": False, "whatsapp": False}
    
    # Send email to business owner
    if email_enabled:
        subject, html_content = get_booking_created_email(
            business_name, customer_name, service_name, date, time
        )
        results["email"] = send_email(business_owner_email, subject, html_content)
    
    # Send WhatsApp to business owner if phone number is available
    if business_owner_phone and whatsapp_enabled:
        whatsapp_message = get_booking_created_whatsapp(customer_name, service_name, date, time)
        results["whatsapp"] = send_whatsapp(business_owner_phone, whatsapp_message)
    
    logger.info(f"Booking created notifications sent: {results}")
    return results


async def notify_booking_approved(
    customer_email: str,
    customer_phone: Optional[str],
    customer_name: str,
    business_name: str,
    service_name: str,
    date: str,
    time: str,
    email_enabled: bool = True,
    whatsapp_enabled: bool = True
):
    """Send notifications when a booking is approved"""
    results = {"email": False, "whatsapp": False}
    
    # Send email to customer
    if email_enabled:
        subject, html_content = get_booking_approved_email(
            customer_name, business_name, service_name, date, time
        )
        results["email"] = send_email(customer_email, subject, html_content)
    
    # Send WhatsApp to customer using approved template
    if customer_phone and whatsapp_enabled:
        # Extract first name from full name
        first_name = customer_name.split()[0] if customer_name else "Customer"
        results["whatsapp"] = send_appointment_confirmation_whatsapp(
            to_number=customer_phone,
            first_name=first_name,
            date=date,
            time=time
        )
    
    logger.info(f"Booking approved notifications sent: {results}")
    return results


async def notify_booking_declined(
    customer_email: str,
    customer_phone: Optional[str],
    customer_name: str,
    business_name: str,
    service_name: str,
    date: str,
    time: str,
    email_enabled: bool = True,
    whatsapp_enabled: bool = True
):
    """Send notifications when a booking is declined"""
    results = {"email": False, "whatsapp": False}
    
    # Send email to customer
    if email_enabled:
        subject, html_content = get_booking_declined_email(
            customer_name, business_name, service_name, date, time
        )
        results["email"] = send_email(customer_email, subject, html_content)
    
    # Send WhatsApp to customer if phone number is available
    if customer_phone and whatsapp_enabled:
        whatsapp_message = get_booking_declined_whatsapp(business_name, service_name, date, time)
        results["whatsapp"] = send_whatsapp(customer_phone, whatsapp_message)
    
    logger.info(f"Booking declined notifications sent: {results}")
    return results


async def notify_booking_cancelled(
    business_owner_email: str,
    business_owner_phone: Optional[str],
    business_name: str,
    customer_name: str,
    service_name: str,
    date: str,
    time: str,
    email_enabled: bool = True,
    whatsapp_enabled: bool = True
):
    """Send notifications when a booking is cancelled"""
    results = {"email": False, "whatsapp": False}
    
    # Send email to business owner
    if email_enabled:
        subject, html_content = get_booking_cancelled_email(
            business_name, customer_name, service_name, date, time
        )
        results["email"] = send_email(business_owner_email, subject, html_content)
    
    # Send WhatsApp to business owner if phone number is available
    if business_owner_phone and whatsapp_enabled:
        whatsapp_message = get_booking_cancelled_whatsapp(customer_name, service_name, date, time)
        results["whatsapp"] = send_whatsapp(business_owner_phone, whatsapp_message)
    
    logger.info(f"Booking cancelled notifications sent: {results}")
    return results


async def send_appointment_reminder(
    customer_email: str,
    customer_phone: Optional[str],
    customer_name: str,
    business_name: str,
    service_name: str,
    date: str,
    time: str,
    email_enabled: bool = True,
    whatsapp_enabled: bool = True
):
    """Send appointment reminder to customer"""
    results = {"email": False, "whatsapp": False}
    
    # Send email reminder
    if email_enabled:
        subject = f"Reminder: Your appointment at {business_name} tomorrow"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 10px; padding: 30px;">
                <h1 style="color: #a3e635; margin-bottom: 20px;">⏰ Appointment Reminder</h1>
                <p>Hello {customer_name},</p>
                <p>This is a reminder about your upcoming appointment:</p>
                <div style="background-color: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong style="color: #a3e635;">Business:</strong> {business_name}</p>
                    <p><strong style="color: #a3e635;">Service:</strong> {service_name}</p>
                    <p><strong style="color: #a3e635;">Date:</strong> {date}</p>
                    <p><strong style="color: #a3e635;">Time:</strong> {time}</p>
                </div>
                <p>We look forward to seeing you!</p>
                <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated reminder from Calendrax.</p>
            </div>
        </body>
        </html>
        """
        results["email"] = send_email(customer_email, subject, html_content)
    
    # Send WhatsApp reminder
    if customer_phone and whatsapp_enabled:
        whatsapp_message = get_booking_reminder_whatsapp(business_name, service_name, date, time)
        results["whatsapp"] = send_whatsapp(customer_phone, whatsapp_message)
    
    logger.info(f"Appointment reminder sent: {results}")
    return results


# ==================== STATUS CHECK ====================

def get_notification_status() -> dict:
    """Returns the current notification service status"""
    return {
        "email": {
            "enabled": EMAIL_ENABLED,
            "provider": "SendGrid" if EMAIL_ENABLED else None,
            "from_address": SENDGRID_FROM_EMAIL if EMAIL_ENABLED else None
        },
        "sms": {
            "enabled": SMS_ENABLED,
            "provider": "Twilio" if SMS_ENABLED else None,
            "from_number": TWILIO_FROM_NUMBER if SMS_ENABLED else None
        },
        "whatsapp": {
            "enabled": WHATSAPP_ENABLED,
            "provider": "Twilio" if WHATSAPP_ENABLED else None,
            "from_number": TWILIO_WHATSAPP_NUMBER if WHATSAPP_ENABLED else None
        }
    }


# ==================== TRIAL REMINDER TEMPLATES ====================

def get_trial_reminder_email(
    business_name: str,
    owner_name: str,
    days_remaining: int,
    monthly_price: float
) -> tuple[str, str]:
    """Returns (subject, html_content) for trial expiration reminder"""
    
    urgency = "⚠️ " if days_remaining <= 2 else ""
    subject = f"{urgency}Your Calendrax Trial Ends in {days_remaining} Day{'s' if days_remaining != 1 else ''}"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 10px; padding: 30px;">
            <h1 style="color: #a3e635; margin-bottom: 20px;">Trial Ending Soon</h1>
            <p>Hello {owner_name},</p>
            <p>Your free trial for <strong>{business_name}</strong> on Calendrax will expire in <strong style="color: #f59e0b;">{days_remaining} day{'s' if days_remaining != 1 else ''}</strong>.</p>
            
            <div style="background-color: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong style="color: #a3e635;">What happens next?</strong></p>
                <p>To continue using Calendrax without interruption, please add a payment method to your account.</p>
                <p><strong style="color: #a3e635;">Your subscription:</strong> £{monthly_price:.2f}/month</p>
            </div>
            
            <p>Log in to your dashboard and navigate to <strong>Profile → Subscription & Payment</strong> to set up your payment method.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="#" style="display: inline-block; background-color: #a3e635; color: #000000; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Set Up Payment</a>
            </div>
            
            <p style="color: #888;">If you have any questions, please contact our support team.</p>
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Calendrax.</p>
        </div>
    </body>
    </html>
    """
    return subject, html_content


def get_trial_reminder_sms(business_name: str, days_remaining: int, monthly_price: float) -> str:
    """Returns SMS message for trial expiration reminder"""
    return f"Calendrax: Your trial for {business_name} ends in {days_remaining} day{'s' if days_remaining != 1 else ''}. Add a payment method to continue (£{monthly_price:.2f}/month). Log in to your dashboard."


def get_trial_reminder_whatsapp(business_name: str, days_remaining: int, monthly_price: float) -> str:
    """Returns WhatsApp message for trial expiration reminder"""
    emoji = "⚠️" if days_remaining <= 2 else "📅"
    return f"""{emoji} *Calendrax Trial Reminder*

Hi! Your free trial for *{business_name}* ends in *{days_remaining} day{'s' if days_remaining != 1 else ''}*.

💳 Subscription: £{monthly_price:.2f}/month

To continue using Calendrax without interruption, please add a payment method in your dashboard.

Go to: Profile → Subscription & Payment

Questions? Reply to this message for help."""


# ==================== TRIAL REMINDER DISPATCHER ====================

async def send_trial_reminder(
    owner_email: str,
    owner_phone: Optional[str],
    owner_name: str,
    business_name: str,
    days_remaining: int,
    monthly_price: float
) -> dict:
    """
    Send trial expiration reminders via all available channels
    
    Args:
        owner_email: Business owner's email address
        owner_phone: Business owner's phone number (E.164 format)
        owner_name: Business owner's name
        business_name: Name of the business
        days_remaining: Days until trial expires
        monthly_price: Monthly subscription price
    
    Returns:
        dict: Status of each notification channel
    """
    results = {
        "email": False,
        "sms": False,
        "whatsapp": False
    }
    
    # Send email reminder
    subject, html_content = get_trial_reminder_email(
        business_name, owner_name, days_remaining, monthly_price
    )
    results["email"] = send_email(owner_email, subject, html_content)
    
    # Send SMS and WhatsApp if phone number is available
    if owner_phone:
        sms_message = get_trial_reminder_sms(business_name, days_remaining, monthly_price)
        results["sms"] = send_sms(owner_phone, sms_message)
        
        whatsapp_message = get_trial_reminder_whatsapp(business_name, days_remaining, monthly_price)
        results["whatsapp"] = send_whatsapp(owner_phone, whatsapp_message)
    
    logger.info(f"Trial reminder sent to {owner_email} (days_remaining={days_remaining}): {results}")
    return results
