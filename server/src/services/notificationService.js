import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { Notification } from '../models/index.js';

let smtpTransporter = null;

function getSmtpTransporter() {
  if (!env.smtp.host || !env.smtp.user) {
    return null;
  }
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  }
  return smtpTransporter;
}

/**
 * Dispatches an email notification via SMTP when configured, or records a simulated
 * notification entry in MongoDB so all alerts remain inspectable in dev/demo mode.
 */
export async function sendEmailNotification({
  organizationId = null,
  recipientUserId = null,
  to,
  subject,
  message,
  html = '',
  eventType = 'GENERAL',
}) {
  if (!to) return null;

  const transporter = getSmtpTransporter();
  let status = 'simulated';
  let providerInfo = 'dev-notification-log';

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject,
        text: message,
        html: html || `<p>${message.replace(/\n/g, '<br/>')}</p>`,
      });
      status = 'sent';
      providerInfo = info.messageId || 'smtp';
    } catch (err) {
      status = 'failed';
      providerInfo = err.message;
      console.error('[Notification:Email] Delivery failed:', err.message);
    }
  } else if (!env.isTest) {
    console.info(`[Notification:Email:Simulated] To=${to} | Subject="${subject}" | ${message}`);
  }

  return Notification.create({
    organizationId,
    recipientUserId,
    recipient: to,
    channel: 'email',
    eventType,
    subject,
    message,
    status,
    providerInfo,
  });
}

/**
 * Dispatches an SMS notification via Twilio REST API when credentials are configured,
 * or records a simulated notification entry in MongoDB.
 */
export async function sendSmsNotification({
  organizationId = null,
  recipientUserId = null,
  to,
  message,
  eventType = 'GENERAL',
}) {
  if (!to) return null;

  let status = 'simulated';
  let providerInfo = 'dev-notification-log';

  if (env.twilio.accountSid && env.twilio.authToken && env.twilio.fromNumber) {
    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.twilio.accountSid}/Messages.json`;
      const body = new URLSearchParams({
        To: to,
        From: env.twilio.fromNumber,
        Body: message,
      });
      const authHeader = Buffer.from(
        `${env.twilio.accountSid}:${env.twilio.authToken}`
      ).toString('base64');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || `Twilio HTTP ${response.status}`);
      }
      status = 'sent';
      providerInfo = payload.sid || 'twilio';
    } catch (err) {
      status = 'failed';
      providerInfo = err.message;
      console.error('[Notification:SMS] Delivery failed:', err.message);
    }
  } else if (!env.isTest) {
    console.info(`[Notification:SMS:Simulated] To=${to} | ${message}`);
  }

  return Notification.create({
    organizationId,
    recipientUserId,
    recipient: to,
    channel: 'sms',
    eventType,
    subject: eventType,
    message,
    status,
    providerInfo,
  });
}
