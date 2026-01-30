# Notification Service for Calendrax
# Supports Email (SendGrid) and SMS (Twilio) notifications

import os
import logging
from typing import Optional
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

# Feature flags - enable/disable notifications
EMAIL_ENABLED = bool(SENDGRID_API_KEY)
SMS_ENABLED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)


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
        
        sms = client.messages.create(
            body=message,
            from_=TWILIO_FROM_NUMBER,
            to=to_number
        )
        
        logger.info(f"SMS sent successfully to {to_number}, SID: {sms.sid}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send SMS to {to_number}: {str(e)}")
        return False


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
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Bookle.</p>
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
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Bookle.</p>
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
            <p style="color: #888; margin-top: 30px; font-size: 12px;">This is an automated message from Bookle.</p>
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


# ==================== NOTIFICATION DISPATCHER ====================

async def notify_booking_created(
    business_owner_email: str,
    business_owner_phone: Optional[str],
    business_name: str,
    customer_name: str,
    service_name: str,
    date: str,
    time: str
):
    """Send notifications when a new booking is created"""
    # Send email to business owner
    subject, html_content = get_booking_created_email(
        business_name, customer_name, service_name, date, time
    )
    send_email(business_owner_email, subject, html_content)
    
    # Send SMS to business owner if phone number is available
    if business_owner_phone:
        sms_message = get_booking_created_sms(customer_name, service_name, date, time)
        send_sms(business_owner_phone, sms_message)


async def notify_booking_approved(
    customer_email: str,
    customer_phone: Optional[str],
    customer_name: str,
    business_name: str,
    service_name: str,
    date: str,
    time: str
):
    """Send notifications when a booking is approved"""
    # Send email to customer
    subject, html_content = get_booking_approved_email(
        customer_name, business_name, service_name, date, time
    )
    send_email(customer_email, subject, html_content)
    
    # Send SMS to customer if phone number is available
    if customer_phone:
        sms_message = get_booking_approved_sms(business_name, service_name, date, time)
        send_sms(customer_phone, sms_message)


async def notify_booking_declined(
    customer_email: str,
    customer_phone: Optional[str],
    customer_name: str,
    business_name: str,
    service_name: str,
    date: str,
    time: str
):
    """Send notifications when a booking is declined"""
    # Send email to customer
    subject, html_content = get_booking_declined_email(
        customer_name, business_name, service_name, date, time
    )
    send_email(customer_email, subject, html_content)
    
    # Send SMS to customer if phone number is available
    if customer_phone:
        sms_message = get_booking_declined_sms(business_name, service_name, date, time)
        send_sms(customer_phone, sms_message)


async def notify_booking_cancelled(
    business_owner_email: str,
    business_owner_phone: Optional[str],
    business_name: str,
    customer_name: str,
    service_name: str,
    date: str,
    time: str
):
    """Send notifications when a booking is cancelled"""
    # Send email to business owner
    subject, html_content = get_booking_cancelled_email(
        business_name, customer_name, service_name, date, time
    )
    send_email(business_owner_email, subject, html_content)
    
    # Send SMS to business owner if phone number is available
    if business_owner_phone:
        sms_message = get_booking_cancelled_sms(customer_name, service_name, date, time)
        send_sms(business_owner_phone, sms_message)


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
        }
    }
