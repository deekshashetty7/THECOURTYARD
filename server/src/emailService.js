const nodemailer = require('nodemailer');
const { env } = require('./config');

let smtpTransporter = null;
let gmailTransporter = null;
let transporter = null;
let smtpAvailable = false;
let gmailAvailable = false;

function getGmailAppPassword() {
  return String(env.gmailAppPassword || '').replace(/\s+/g, '');
}

function getEmailFromAddress(provider = null) {
  if (provider === 'gmail' && env.gmailAdminEmail) {
    return `"Courtyard" <${env.gmailAdminEmail}>`;
  }

  if (env.emailFrom) return env.emailFrom;
  if (env.gmailAdminEmail) return `"Courtyard" <${env.gmailAdminEmail}>`;
  if (env.smtpUser) return `"Courtyard" <${env.smtpUser}>`;
  return 'Courtyard <onboarding@resend.dev>';
}

function getConfiguredProviders() {
  const order = String(env.emailProviderOrder || 'smtp,gmail,resend')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const available = new Set();
  if (env.brevoApiKey) available.add('brevo');
  if (smtpAvailable && smtpTransporter) available.add('smtp');
  if (gmailAvailable && gmailTransporter) available.add('gmail');
  if (env.resendApiKey) available.add('resend');

  const providers = order.filter((provider) => available.has(provider));
  return providers.length ? providers : [...available];
}

function getEmailProvider() {
  return getConfiguredProviders()[0] || 'none';
}

function isGmailConfigured() {
  const email = String(env.gmailAdminEmail || '').trim();
  const password = getGmailAppPassword();
  if (!email || !password) return false;
  if (email === 'you@example.com' || password === 'your_gmail_app_password') return false;
  return true;
}

function isEmailConfigured() {
  return getEmailProvider() !== 'none';
}

function parseEmailFromAddress(provider = null) {
  const from = getEmailFromAddress(provider);
  const emailMatch = from.match(/<([^>]+)>/);
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  return {
    email: emailMatch ? emailMatch[1].trim() : from.trim(),
    name: nameMatch ? nameMatch[1].trim() : 'Courtyard',
  };
}

async function sendViaBrevoApi({ to, subject, html, text }) {
  const sender = parseEmailFromAddress();
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.brevoApiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Brevo API failed (${response.status})`);
  }
  return data;
}

async function sendViaResend({ to, subject, html, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getEmailFromAddress(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Resend failed (${response.status})`);
  }
  return data;
}

async function sendWithProvider(provider, { to, subject, html, text }) {
  if (provider === 'brevo') {
    await sendViaBrevoApi({ to, subject, html, text });
    console.log(`Email sent via Brevo API to ${to}`);
    return true;
  }

  if (provider === 'resend') {
    await sendViaResend({ to, subject, html, text });
    console.log(`Email sent via Resend to ${to}`);
    return true;
  }

  const mailTransporter = provider === 'gmail' ? gmailTransporter : smtpTransporter;
  if (!mailTransporter) {
    throw new Error(`Email transporter is not initialized for ${provider}`);
  }

  const info = await mailTransporter.sendMail({
    from: getEmailFromAddress(provider),
    to,
    subject,
    html,
    text,
    headers: provider === 'smtp' ? { 'X-Sib-Track': 'false' } : undefined,
  });
  console.log(`Email sent via ${provider} to ${to}:`, info.response || info.messageId);
  return true;
}

async function sendMailMessage({ to, subject, html, text }) {
  const providers = getConfiguredProviders();
  if (!providers.length) {
    throw new Error('Email service is not configured');
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      if (provider === 'brevo') {
        return await sendWithProvider('brevo', { to, subject, html, text });
      }
      if (provider === 'resend') {
        return await sendWithProvider('resend', { to, subject, html, text });
      }
      if (provider === 'gmail' && gmailTransporter) {
        return await sendWithProvider('gmail', { to, subject, html, text });
      }
      if (provider === 'smtp' && smtpTransporter) {
        return await sendWithProvider('smtp', { to, subject, html, text });
      }
      throw new Error(`Provider ${provider} is not ready`);
    } catch (error) {
      lastError = error;
      console.warn(`Email provider "${provider}" failed for ${to}:`, error instanceof Error ? error.message : error);
    }
  }

  throw lastError || new Error('All email providers failed');
}

async function verifyEmailService() {
  const providers = getConfiguredProviders();
  if (!providers.length) {
    return { ok: false, reason: 'Email not configured. Set SMTP_*, GMAIL_* or RESEND_API_KEY in server/.env' };
  }

  if (providers.includes('brevo')) {
    return { ok: true, provider: 'brevo' };
  }

  if (providers.includes('resend') && !providers.includes('smtp') && !providers.includes('gmail')) {
    return {
      ok: true,
      provider: 'resend',
      warning: 'Resend test mode only sends to your Resend account email unless a domain is verified',
    };
  }

  if (!gmailTransporter && !smtpTransporter) {
    return { ok: false, reason: 'Email transporter is not initialized' };
  }

  const primaryProvider = getEmailProvider();
  const mailTransporter = primaryProvider === 'gmail' ? gmailTransporter : smtpTransporter || gmailTransporter;

  try {
    if (mailTransporter) {
      await mailTransporter.verify();
    }
    return { ok: true, provider: primaryProvider };
  } catch (error) {
    return {
      ok: false,
      provider: getEmailProvider(),
      reason: error instanceof Error ? error.message : 'Email authentication failed',
    };
  }
}

function initializeEmailService() {
  console.log('Initializing email service...');

  if (!env.brevoApiKey && !(env.smtpHost && env.smtpUser && env.smtpPass) && !isGmailConfigured() && !env.resendApiKey) {
    console.warn('Email not configured. Add BREVO_API_KEY, SMTP, Gmail, or Resend settings in server/.env');
    return null;
  }

  if (env.brevoApiKey) {
    console.log('Brevo API available');
  } else {
    console.warn('BREVO_API_KEY is missing. Add an API key from https://app.brevo.com/settings/keys/api for reliable OTP delivery.');
  }

  if (env.resendApiKey) {
    console.log('Resend API available');
  }

  try {
    if (env.smtpHost && env.smtpUser && env.smtpPass) {
      smtpTransporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        requireTLS: env.smtpPort === 587,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
      });
      console.log('SMTP transporter configured');
    }

    if (isGmailConfigured()) {
      gmailTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: env.gmailAdminEmail,
          pass: getGmailAppPassword(),
        },
      });
      console.log('Gmail transporter configured');
    }

    transporter = gmailTransporter || smtpTransporter;
    return transporter;
  } catch (error) {
    console.error('Failed to configure email service:', error);
    return null;
  }
}

async function finalizeEmailService() {
  smtpAvailable = false;
  gmailAvailable = false;

  if (smtpTransporter) {
    try {
      await smtpTransporter.verify();
      smtpAvailable = true;
      console.log('SMTP transporter verified');
    } catch (error) {
      console.warn('SMTP transporter unavailable:', error instanceof Error ? error.message : error);
      smtpTransporter = null;
    }
  }

  if (gmailTransporter) {
    try {
      await gmailTransporter.verify();
      gmailAvailable = true;
      console.log('Gmail transporter verified');
    } catch (error) {
      console.warn('Gmail transporter unavailable:', error instanceof Error ? error.message : error);
      gmailTransporter = null;
    }
  }

  transporter = gmailTransporter || smtpTransporter;
  const providers = getConfiguredProviders();
  console.log('Active email providers:', providers.join(' -> ') || 'none');
  return transporter;
}

async function sendVerificationEmail(recipientEmail, verificationLink, userName) {
  try {
    if (!transporter) {
      throw new Error('Email service is not configured');
    }

    const mailOptions = {
      from: `"Courtyard" <${env.gmailAdminEmail}>`,
      to: recipientEmail,
      subject: 'Verify Your Email - Courtyard',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
            <h1 style="color: #333; margin: 0;">Welcome to Courtyard! 🎉</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="color: #333; font-size: 16px;">Hello ${userName},</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Thank you for signing up! To complete your registration, please verify your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="color: #666; font-size: 13px;">
              Or copy and paste this link in your browser:<br/>
              <code style="background-color: #f0f0f0; padding: 2px 6px; border-radius: 3px; word-break: break-all;">${verificationLink}</code>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              This link will expire in ${env.emailVerificationExpiryMinutes} minutes.<br/>
              If you didn't create this account, please ignore this email.
            </p>
          </div>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p>© ${new Date().getFullYear()} Courtyard. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `
        Welcome to Courtyard!
        
        Click this link to verify your email:
        ${verificationLink}
        
        This link will expire in ${env.emailVerificationExpiryMinutes} minutes.
        
        If you didn't create this account, please ignore this email.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBookingDate(date) {
  if (!date) {
    return 'Not specified';
  }

  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return String(date);
  }

  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

async function sendBookingConfirmationEmail(recipientEmail, booking) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured');
  }

  const slots = Array.isArray(booking.slots) ? booking.slots : [];
  const slotRows = slots.length
    ? slots.map(slot => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Court ${escapeHtml(slot.court)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(slot.time)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="2" style="padding: 8px;">No slots listed</td></tr>';

  const slotText = slots.length
    ? slots.map(slot => `Court ${slot.court}: ${slot.time}`).join('\n')
    : 'No slots listed';

  const subject = `Booking Confirmed - ${booking.id}`;
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <div style="background-color: #064e3b; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Booking Confirmed</h1>
          <p style="margin: 8px 0 0;">Your court booking is confirmed.</p>
        </div>
        <div style="padding: 24px; background-color: #ffffff;">
          <p>Hello ${escapeHtml(booking.userName || 'Guest')},</p>
          <p>Thank you for booking with Courtyard. Here are your booking details:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #4b5563;">Booking ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.id)}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Court</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.courtName)}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Date</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(formatBookingDate(booking.date))}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentId || 'Not available')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment Method</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentMethod || 'online')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment Status</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentStatus || 'paid')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Total Amount</td><td style="padding: 8px; font-weight: bold;">INR ${escapeHtml(booking.totalAmount)}</td></tr>
          </table>
          <h2 style="font-size: 18px; margin: 20px 0 8px;">Booked Slots</h2>
          <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #d1d5db;">Court</th>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #d1d5db;">Time</th>
              </tr>
            </thead>
            <tbody>${slotRows}</tbody>
          </table>
          <p style="margin-top: 24px; color: #4b5563;">Please keep this email for your records.</p>
        </div>
      </div>
    `;
  const text = `
Booking Confirmed

Hello ${booking.userName || 'Guest'},

Your court booking is confirmed.

Booking ID: ${booking.id}
Court: ${booking.courtName}
Date: ${formatBookingDate(booking.date)}
Payment ID: ${booking.paymentId || 'Not available'}
Payment Method: ${booking.paymentMethod || 'online'}
Payment Status: ${booking.paymentStatus || 'paid'}
Total Amount: INR ${booking.totalAmount}

Booked Slots:
${slotText}
    `;

  try {
    await sendMailMessage({ to: recipientEmail, subject, html, text });
    return true;
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error);
    throw error;
  }
}

function getAdminNotificationEmail() {
  return String(env.gmailAdminEmail || env.adminSeedEmail || parseEmailFromAddress().email || '').trim().toLowerCase();
}

async function sendAdminBookingAlertEmail(booking) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured');
  }

  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) {
    throw new Error('Admin email is not configured');
  }

  const slots = Array.isArray(booking.slots) ? booking.slots : [];
  const slotRows = slots.length
    ? slots.map(slot => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Court ${escapeHtml(slot.court)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(slot.time)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="2" style="padding: 8px;">No slots listed</td></tr>';

  const slotText = slots.length
    ? slots.map(slot => `Court ${slot.court}: ${slot.time}`).join('\n')
    : 'No slots listed';

  const subject = `New Booking Received - ${booking.id}`;
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <div style="background-color: #064e3b; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">New Booking Received</h1>
          <p style="margin: 8px 0 0;">A new booking has been created in Courtyard.</p>
        </div>
        <div style="padding: 24px; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #4b5563;">Booking ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.id)}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Source</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.source || 'user-app')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Customer Name</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.userName || 'Not provided')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Customer Email</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.userEmail || 'Not provided')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Customer Phone</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.userPhone || 'Not provided')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Court</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.courtName)}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Date</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(formatBookingDate(booking.date))}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentId || 'Not available')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment Method</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentMethod || 'online')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment Status</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentStatus || 'paid')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Total Amount</td><td style="padding: 8px; font-weight: bold;">INR ${escapeHtml(booking.totalAmount)}</td></tr>
          </table>
          <h2 style="font-size: 18px; margin: 20px 0 8px;">Booked Slots</h2>
          <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #d1d5db;">Court</th>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #d1d5db;">Time</th>
              </tr>
            </thead>
            <tbody>${slotRows}</tbody>
          </table>
        </div>
      </div>
    `;
  const text = `
New Booking Received

Booking ID: ${booking.id}
Source: ${booking.source || 'user-app'}
Customer Name: ${booking.userName || 'Not provided'}
Customer Email: ${booking.userEmail || 'Not provided'}
Customer Phone: ${booking.userPhone || 'Not provided'}
Court: ${booking.courtName}
Date: ${formatBookingDate(booking.date)}
Payment ID: ${booking.paymentId || 'Not available'}
Payment Method: ${booking.paymentMethod || 'online'}
Payment Status: ${booking.paymentStatus || 'paid'}
Total Amount: INR ${booking.totalAmount}

Booked Slots:
${slotText}
    `;

  try {
    await sendMailMessage({ to: adminEmail, subject, html, text });
    return true;
  } catch (error) {
    console.error('Failed to send admin booking alert email:', error);
    throw error;
  }
}

async function sendSubscriptionConfirmationEmail(recipientEmail, subscription) {
  try {
    if (!transporter) {
      throw new Error('Email service is not configured');
    }

    const mailOptions = {
      from: `"Courtyard" <${env.gmailAdminEmail}>`,
      to: recipientEmail,
      subject: `Subscription Confirmed - ${subscription.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <div style="background-color: #064e3b; color: #ffffff; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Subscription Confirmed</h1>
            <p style="margin: 8px 0 0;">Your monthly court subscription is active.</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p>Hello ${escapeHtml(subscription.userName || 'Guest')},</p>
            <p>Thank you for subscribing with Courtyard. Here are your subscription details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; color: #4b5563;">Subscription ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(subscription.id)}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Court</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(subscription.courtName || `Court ${subscription.court}`)}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Time Slot</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(subscription.timeSlot)}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Start Date</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(formatBookingDate(subscription.startDate))}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">End Date</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(formatBookingDate(subscription.endDate))}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Weekdays</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(subscription.weekdaysCount)}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Payment ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(subscription.paymentId || 'Not available')}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Payment Method</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(subscription.paymentMethod || 'online')}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Payment Status</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(subscription.paymentStatus || 'paid')}</td></tr>
              <tr><td style="padding: 8px; color: #4b5563;">Amount</td><td style="padding: 8px; font-weight: bold;">INR ${escapeHtml(subscription.amount)}</td></tr>
            </table>
            <p style="margin-top: 24px; color: #4b5563;">Please keep this email for your records.</p>
          </div>
        </div>
      `,
      text: `
Subscription Confirmed

Hello ${subscription.userName || 'Guest'},

Your monthly court subscription is active.

Subscription ID: ${subscription.id}
Court: ${subscription.courtName || `Court ${subscription.court}`}
Time Slot: ${subscription.timeSlot}
Start Date: ${formatBookingDate(subscription.startDate)}
End Date: ${formatBookingDate(subscription.endDate)}
Weekdays: ${subscription.weekdaysCount}
Payment ID: ${subscription.paymentId || 'Not available'}
Payment Method: ${subscription.paymentMethod || 'online'}
Payment Status: ${subscription.paymentStatus || 'paid'}
Amount: INR ${subscription.amount}
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Subscription confirmation email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Failed to send subscription confirmation email:', error);
    throw error;
  }
}

async function sendBookingCancellationEmail(recipientEmail, booking) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured');
  }

  const slots = Array.isArray(booking.slots) ? booking.slots : [];
  const slotRows = slots.length
    ? slots.map(slot => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Court ${escapeHtml(slot.court)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(slot.time)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="2" style="padding: 8px;">No slots listed</td></tr>';

  const slotText = slots.length
    ? slots.map(slot => `Court ${slot.court}: ${slot.time}`).join('\n')
    : 'No slots listed';

  const subject = `Booking Cancelled - ${booking.id}`;
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <div style="background-color: #991b1b; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
          <p style="margin: 8px 0 0;">Your court booking has been cancelled.</p>
        </div>
        <div style="padding: 24px; background-color: #ffffff;">
          <p>Hello ${escapeHtml(booking.userName || 'Guest')},</p>
          <p>This email confirms that your Courtyard booking has been cancelled.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #4b5563;">Booking ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.id)}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Court</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.courtName)}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Date</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(formatBookingDate(booking.date))}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment ID</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentId || 'Not available')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Payment Method</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.paymentMethod || 'online')}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Total Amount</td><td style="padding: 8px; font-weight: bold;">INR ${escapeHtml(booking.totalAmount)}</td></tr>
            <tr><td style="padding: 8px; color: #4b5563;">Reason</td><td style="padding: 8px; font-weight: bold;">${escapeHtml(booking.cancelReason || 'Cancelled')}</td></tr>
          </table>
          <h2 style="font-size: 18px; margin: 20px 0 8px;">Cancelled Slots</h2>
          <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #d1d5db;">Court</th>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #d1d5db;">Time</th>
              </tr>
            </thead>
            <tbody>${slotRows}</tbody>
          </table>
          <p style="margin-top: 24px; color: #4b5563;">Please contact us if you need help with this cancellation.</p>
        </div>
      </div>
    `;
  const text = `
Booking Cancelled

Hello ${booking.userName || 'Guest'},

Your Courtyard booking has been cancelled.

Booking ID: ${booking.id}
Court: ${booking.courtName}
Date: ${formatBookingDate(booking.date)}
Payment ID: ${booking.paymentId || 'Not available'}
Payment Method: ${booking.paymentMethod || 'online'}
Total Amount: INR ${booking.totalAmount}
Reason: ${booking.cancelReason || 'Cancelled'}

Cancelled Slots:
${slotText}
    `;

  try {
    await sendMailMessage({ to: recipientEmail, subject, html, text });
    return true;
  } catch (error) {
    console.error('Failed to send booking cancellation email:', error);
    throw error;
  }
}

async function sendPasswordResetEmail(recipientEmail, resetLink, userName) {
  try {
    if (!transporter) {
      throw new Error('Email service is not configured');
    }

    const mailOptions = {
      from: `"Courtyard" <${env.gmailAdminEmail}>`,
      to: recipientEmail,
      subject: 'Reset Your Courtyard Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
            <h1 style="color: #333; margin: 0;">Password Reset Request</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="color: #333; font-size: 16px;">Hello ${escapeHtml(userName || 'User')},</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              We received a request to reset your password. Click the button below to set a new password. This link will expire in ${env.emailVerificationExpiryMinutes} minutes.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 13px;">
              Or copy and paste this link in your browser:<br/>
              <code style="background-color: #f0f0f0; padding: 2px 6px; border-radius: 3px; word-break: break-all;">${resetLink}</code>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              If you didn't request a password reset, please ignore this email.
            </p>
          </div>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p>© ${new Date().getFullYear()} Courtyard. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `
Reset Your Courtyard Password

Hello ${userName || 'User'},

Use the link below to reset your password:
${resetLink}

If you didn't request a password reset, please ignore this email.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

async function sendOTPEmail(recipientEmail, otpCode, userName = 'User') {
  const subject = 'Your Courtyard Verification Code';
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
            <h1 style="color: #333; margin: 0;">Email Verification</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="color: #333; font-size: 16px;">Hello ${escapeHtml(userName)},</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Your verification code for registering with Courtyard is:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; display: inline-block;">
                <p style="font-size: 32px; font-weight: bold; color: #16a34a; margin: 0; letter-spacing: 5px;">${otpCode}</p>
              </div>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              This code will expire in ${env.otpExpiryMinutes} minutes. Do not share this code with anyone.
            </p>
          </div>
        </div>
      `;
  const text = `Your Courtyard Verification Code: ${otpCode}\n\nThis code expires in ${env.otpExpiryMinutes} minutes.`;

  try {
    await sendMailMessage({ to: recipientEmail, subject, html, text });
    return true;
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    throw error;
  }
}

module.exports = {
  initializeEmailService,
  finalizeEmailService,
  verifyEmailService,
  isEmailConfigured,
  getEmailProvider,
  getConfiguredProviders,
  sendMailMessage,
  sendVerificationEmail,
  sendBookingConfirmationEmail,
  sendAdminBookingAlertEmail,
  sendBookingCancellationEmail,
  sendSubscriptionConfirmationEmail,
  sendPasswordResetEmail,
  sendOTPEmail,
};
