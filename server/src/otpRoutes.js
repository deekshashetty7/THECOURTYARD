const express = require('express');
const bcryptjs = require('bcryptjs');
const { asyncHandler, ApiError, buildCookieOptions } = require('./middleware');
const {
	getUserByEmail,
	getUserByPhone,
	createOTPToken,
	verifyOTP,
	createPendingRegistration,
	getPendingRegistration,
	getPendingRegistrationByEmailAndPhone,
	updatePendingRegistrationDetails,
	updatePendingRegistrationOTP,
	markPendingRegistrationOTPVerified,
	completePendingRegistration,
} = require('./dataServices');
const { sendOTPEmail } = require('./emailService');
const { generateAuthToken, generateRefreshToken } = require('./tokenUtils');
const { env } = require('./config');

const router = express.Router();

async function deliverEmailOTP(email, otpCode, name) {
	try {
		await sendOTPEmail(email, otpCode, name);
		return { emailSent: true };
	} catch (error) {
		console.error('Failed to send email OTP:', error);
		const message = error instanceof Error ? error.message : 'Email delivery failed';
		throw new ApiError(503, `Unable to send verification email. ${message}`);
	}
}

router.post('/auth/register-start', asyncHandler(async (req, res) => {
	const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
	const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
	const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

	if (!name || !email || !phone || !password) {
		throw new ApiError(400, 'name, email, phone, and password are required');
	}

	if (password.length < 6) {
		throw new ApiError(400, 'Password must be at least 6 characters');
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new ApiError(400, 'Invalid email format');
	}

	if (!/^\+?[0-9\s()-]{10,16}$/.test(phone)) {
		throw new ApiError(400, 'Invalid phone format');
	}

	const existingUser = await getUserByEmail(email);
	if (existingUser) {
		throw new ApiError(409, 'Email already registered');
	}

	const existingPhoneUser = await getUserByPhone(phone);
	if (existingPhoneUser) {
		throw new ApiError(409, 'Phone already registered');
	}

	const passwordHash = await bcryptjs.hash(password, 10);

	const existingPending = await getPendingRegistrationByEmailAndPhone(email, phone);
	if (existingPending) {
		await updatePendingRegistrationDetails(existingPending.id, name, passwordHash);
		const emailOTP = await createOTPToken(email, null, 'email');
		await updatePendingRegistrationOTP(existingPending.id, emailOTP.id, 'email');
		const emailDelivery = await deliverEmailOTP(email, emailOTP.otpCode, name);

		return res.status(200).json({
			message: emailDelivery.emailSent
				? 'Registration resumed. OTP sent to your email.'
				: 'Registration resumed. Email delivery failed in development.',
			registrationId: existingPending.id,
			email: existingPending.email,
			phone: existingPending.phone,
			otpSentTo: 'email',
			expiresAt: existingPending.expiresAt,
			emailSent: emailDelivery.emailSent,
			...(emailDelivery.devOtp ? { devOtp: emailDelivery.devOtp } : {}),
			...(emailDelivery.emailDeliveryError ? { emailDeliveryError: emailDelivery.emailDeliveryError } : {}),
		});
	}

	const pending = await createPendingRegistration(name, email, phone, passwordHash);
	const emailOTP = await createOTPToken(email, null, 'email');
	await updatePendingRegistrationOTP(pending.id, emailOTP.id, 'email');

	const emailDelivery = await deliverEmailOTP(email, emailOTP.otpCode, name);

	res.status(201).json({
		message: emailDelivery.emailSent
			? 'Registration started. OTP sent to your email.'
			: 'Registration started. Email delivery failed in development.',
		registrationId: pending.id,
		email: pending.email,
		phone: pending.phone,
		otpSentTo: 'email',
		expiresAt: pending.expiresAt,
		emailSent: emailDelivery.emailSent,
		...(emailDelivery.devOtp ? { devOtp: emailDelivery.devOtp } : {}),
		...(emailDelivery.emailDeliveryError ? { emailDeliveryError: emailDelivery.emailDeliveryError } : {}),
	});
}));

router.post('/auth/verify-email-otp', asyncHandler(async (req, res) => {
	const registrationId = typeof req.body?.registrationId === 'string' ? req.body.registrationId.trim() : '';
	const otpCode = typeof req.body?.otpCode === 'string' ? req.body.otpCode.trim() : '';

	if (!registrationId || !otpCode) {
		throw new ApiError(400, 'registrationId and otpCode are required');
	}

	const pending = await getPendingRegistration(registrationId);
	if (!pending) {
		throw new ApiError(404, 'Registration not found');
	}

	if (!pending.emailOtpId) {
		throw new ApiError(400, 'Email OTP not initialized');
	}

	await verifyOTP(pending.emailOtpId, otpCode);
	await markPendingRegistrationOTPVerified(registrationId, 'email');

	const user = await completePendingRegistration(registrationId);
	const accessToken = generateAuthToken(user.id, user.email, user.name, user.role, true);
	const refreshToken = generateRefreshToken(user.id);

	res.cookie(env.jwtCookieName, accessToken, buildCookieOptions());

	res.status(201).json({
		message: 'Registration completed successfully',
		registrationId,
		accessToken,
		refreshToken,
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			role: user.role,
			emailVerified: true,
		},
	});
}));

router.post('/auth/resend-email-otp', asyncHandler(async (req, res) => {
	const registrationId = typeof req.body?.registrationId === 'string' ? req.body.registrationId.trim() : '';

	if (!registrationId) {
		throw new ApiError(400, 'registrationId is required');
	}

	const pending = await getPendingRegistration(registrationId);
	if (!pending) {
		throw new ApiError(404, 'Registration not found');
	}

	const emailOTP = await createOTPToken(pending.email, null, 'email');
	await updatePendingRegistrationOTP(registrationId, emailOTP.id, 'email');
	const emailDelivery = await deliverEmailOTP(pending.email, emailOTP.otpCode, pending.name);

	res.json({
		message: emailDelivery.emailSent ? 'Email OTP resent successfully' : 'Email OTP regenerated (delivery failed in development)',
		registrationId,
		otpSentTo: 'email',
		emailSent: emailDelivery.emailSent,
		...(emailDelivery.devOtp ? { devOtp: emailDelivery.devOtp } : {}),
		...(emailDelivery.emailDeliveryError ? { emailDeliveryError: emailDelivery.emailDeliveryError } : {}),
	});
}));

module.exports = router;
