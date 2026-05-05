import nodemailer from 'nodemailer';
import { User } from '../models/index.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  return transporter;
}

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@dermas.local';
}

async function sendMail({ to, subject, text, html }) {
  const smtp = getTransporter();
  if (!smtp || !to || (Array.isArray(to) && to.length === 0)) {
    return false;
  }

  await smtp.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  return true;
}

async function getAdminRecipients() {
  const configured = String(process.env.ADMIN_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length > 0) return configured;

  const admins = await User.find({ role: 'admin', isActive: true }).select('email').lean();
  return admins.map((admin) => admin.email).filter(Boolean);
}

export async function notifyRegistrationSubmitted(request) {
  try {
    const recipients = await getAdminRecipients();
    const uiUrl = process.env.FRONTEND_APP_URL || 'http://localhost:5173';
    const requestId = String(request._id || '').toUpperCase();

    await sendMail({
      to: recipients,
      subject: `New Account Request: ${request.fullName}`,
      text: [
        'A new registration request was submitted.',
        `Request ID: ${requestId}`,
        `Name: ${request.fullName}`,
        `Email: ${request.email}`,
        `Phone: ${request.phoneNumber}`,
        `Requested Department: ${request.requestedDepartment || '-'}`,
        '',
        `Review: ${uiUrl}/employees/account-requests`,
      ].join('\n'),
      html: `
        <p>A new registration request was submitted.</p>
        <ul>
          <li><strong>Request ID:</strong> ${requestId}</li>
          <li><strong>Name:</strong> ${request.fullName}</li>
          <li><strong>Email:</strong> ${request.email}</li>
          <li><strong>Phone:</strong> ${request.phoneNumber}</li>
          <li><strong>Requested Department:</strong> ${request.requestedDepartment || '-'}</li>
        </ul>
        <p><a href="${uiUrl}/employees/account-requests">Open Account Requests</a></p>
      `,
    });
  } catch (err) {
    console.error('Registration submit email failed:', err.message);
  }
}

export async function notifyRegistrationApproved(request) {
  try {
    const uiUrl = process.env.FRONTEND_APP_URL || 'http://localhost:5173';

    await sendMail({
      to: request.email,
      subject: 'Your account request has been approved',
      text: [
        `Hello ${request.fullName},`,
        '',
        'Your account request has been approved. You can now sign in to the system.',
        '',
        `Sign in: ${uiUrl}/login`,
      ].join('\n'),
      html: `
        <p>Hello ${request.fullName},</p>
        <p>Your account request has been <strong>approved</strong>. You can now sign in to the system.</p>
        <p><a href="${uiUrl}/login">Go to Login</a></p>
      `,
    });
  } catch (err) {
    console.error('Registration approved email failed:', err.message);
  }
}

export async function notifyRegistrationRejected(request) {
  try {
    const uiUrl = process.env.FRONTEND_APP_URL || 'http://localhost:5173';
    const reason = request.rejectionReason?.trim();

    await sendMail({
      to: request.email,
      subject: 'Your account request was declined',
      text: [
        `Hello ${request.fullName},`,
        '',
        'Your account request was declined. Please contact the administrator for assistance.',
        reason ? `Reason: ${reason}` : '',
        '',
        `Status: ${uiUrl}/request-status`,
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <p>Hello ${request.fullName},</p>
        <p>Your account request was <strong>declined</strong>. Please contact the administrator for assistance.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p><a href="${uiUrl}/request-status">Check Request Status</a></p>
      `,
    });
  } catch (err) {
    console.error('Registration rejected email failed:', err.message);
  }
}

export async function notifyPasswordResetRequested({ email, name, token }) {
  try {
    const uiUrl = process.env.FRONTEND_APP_URL || 'http://localhost:5173';
    const resetUrl = `${uiUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await sendMail({
      to: email,
      subject: 'Password Reset Request',
      text: [
        `Hello ${name || 'User'},`,
        '',
        'We received a request to reset your password.',
        `Reset your password: ${resetUrl}`,
        '',
        'If you did not request this, please ignore this email.',
      ].join('\n'),
      html: `
        <p>Hello ${name || 'User'},</p>
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error('Password reset email failed:', err.message);
  }
}
