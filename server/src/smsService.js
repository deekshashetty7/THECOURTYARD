const { env } = require('./config');

async function sendOTPSms(phone, otpCode) {
  const accountSid = String(env.twilio_account_sid || '').trim();
  const authToken = String(env.twilio_auth_token || '').trim();
  const fromNumber = String(env.twilio_phone_number || '').trim();

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[OTP] Phone OTP for ${phone}: ${otpCode} (SMS not configured)`);
    return { smsSent: false, devOtp: otpCode };
  }

  try {
    const body = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: `Your Courtyard verification code is ${otpCode}. Valid for ${env.otpExpiryMinutes} minutes.`,
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || `Twilio request failed (${response.status})`);
    }

    console.log(`Phone OTP SMS sent to ${phone}`);
    return { smsSent: true };
  } catch (error) {
    console.error('Failed to send phone OTP SMS:', error);
    console.log(`[OTP] Phone OTP for ${phone}: ${otpCode}`);
    return {
      smsSent: false,
      devOtp: otpCode,
      smsDeliveryError: error instanceof Error ? error.message : 'SMS delivery failed',
    };
  }
}

module.exports = {
  sendOTPSms,
};
