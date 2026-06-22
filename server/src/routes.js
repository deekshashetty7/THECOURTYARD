const express = require('express');
const bcryptjs = require('bcryptjs');
const dataServices = require('./dataServices');
const {
	asyncHandler,
	requireAuth,
	requireRole,
	ApiError,
	buildCookieOptions,
} = require('./middleware');
const {
	getAppSettings,
	updateAppSettings,
	getGalleryImages,
	replaceGalleryImages,
	deleteGalleryImage,
	getAvailability,
	listCourtBlocks,
	createCourtBlockRecord,
	deleteCourtBlock,
	createBookingRecord,
	listBookings,
	cancelBooking,
	updateBooking,
	createSubscriptionRecord,
	listSubscriptions,
	cancelSubscription,
	updateSubscription,
	getDashboardStats,
	getRevenueSeries,
	listUsers,
	deleteUser,
	createContactMessage,
	listContactMessages,
	listContactMessagesByEmail,
	replyToContactMessage,
	listReviews,
	createReview,
	replyToReview,
	deleteReview,
	storeVerificationToken,
	verifyEmail,
	checkEmailVerification,
	createUser,
	getUserByEmail,
	getUserById,
	updateUserProfile,
	markEmailVerified,
	updateUserPassword,
} = dataServices;
const { uploadGalleryImage, resolveProfilePhotoUrl } = require('./cloudinary');
const {
	sendVerificationEmail,
	sendBookingConfirmationEmail,
	sendAdminBookingAlertEmail,
	sendBookingCancellationEmail,
	sendSubscriptionConfirmationEmail,
} = require('./emailService');
const { 
	generateJWTVerificationToken, 
	getTokenExpiryTime,
	generateAuthToken,
	generateRefreshToken,
	generatePasswordResetToken,
	verifyPasswordResetToken,
} = require('./tokenUtils');
const { env } = require('./config');

const router = express.Router();

const mapPublicUser = (user) => ({
	id: user.id,
	name: user.name,
	email: user.email,
	phone: user.phone,
	location: user.location || null,
	photoUrl: user.photoUrl || null,
	role: user.role,
	emailVerified: user.emailVerified,
});


const { sendPasswordResetEmail } = require('./emailService');

async function resolveAdminTargetUserId(req) {
	const body = req.body || {};
	const explicitUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
	if (explicitUserId && /^[0-9a-fA-F-]{36}$/.test(explicitUserId)) {
		return explicitUserId;
	}

	const email = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
	const phone = typeof body.userPhone === 'string' ? body.userPhone.trim() : '';
	if (!email && !phone) {
		return req.auth.sub;
	}

	const users = await listUsers();
	const match = users.find(user => (email && user.email === email) || (phone && user.phone === phone));
	return match?.id || req.auth.sub;
}

router.get('/', (_req, res) => {
	res.json({ status: 'ok', service: 'tcy-backend', api: '/api' });
});

router.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

async function sendEmailVerificationLink(req, res) {
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
	const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'User';
	
	if (!email) {
		throw new ApiError(400, 'email is required');
	}

	void name;

	res.json({
		message: 'Email verification is disabled. No verification email was sent.',
		email,
		sent: false,
	});
}

router.post('/auth/verify-email-send', asyncHandler(sendEmailVerificationLink));
router.post('/auth/resend-verification-email', asyncHandler(sendEmailVerificationLink));

router.post('/auth/password-reset', asyncHandler(async (req, res) => {
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
	if (!email) {
		throw new ApiError(400, 'email is required');
	}

	const user = await getUserByEmail(email);
	if (!user) {
		res.json({ message: 'If an account exists for this email, a password reset link has been sent.' });
		return;
	}

	const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
	const resetToken = generatePasswordResetToken(email);
	const resetPath = user.role === 'admin' ? '/admin/reset-password' : '/user/reset-password';
	const resetLink = `${clientOrigin}${resetPath}?token=${encodeURIComponent(resetToken)}`;

	try {
		await sendPasswordResetEmail(email, resetLink, user.name);
		res.json({ message: 'Password reset email sent' });
	} catch (sendErr) {
		console.error('Server email send failed for password reset:', sendErr);
		throw new ApiError(503, 'Server email service is not configured or failed to send');
	}
}));

router.post('/auth/reset-password', asyncHandler(async (req, res) => {
	const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
	const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';

	if (!token || !newPassword) {
		throw new ApiError(400, 'token and newPassword are required');
	}

	if (newPassword.length < 6) {
		throw new ApiError(400, 'New password must be at least 6 characters');
	}

	const decoded = verifyPasswordResetToken(token);
	if (!decoded?.email) {
		throw new ApiError(401, 'Invalid or expired reset link');
	}

	const user = await getUserByEmail(decoded.email);
	if (!user) {
		throw new ApiError(404, 'User not found');
	}

	const newPasswordHash = await bcryptjs.hash(newPassword, 10);
	await updateUserPassword(user.id, newPasswordHash);

	res.json({ message: 'Password updated successfully' });
}));

async function sendBookingConfirmationIfPossible(booking) {
	const recipientEmail = typeof booking?.userEmail === 'string' ? booking.userEmail.trim().toLowerCase() : '';
	if (!recipientEmail) {
		return false;
	}

	try {
		await sendBookingConfirmationEmail(recipientEmail, booking);
		return true;
	} catch (error) {
		console.error('Booking was created, but confirmation email failed:', error);
		return false;
	}
}

async function sendBookingCancellationIfPossible(booking) {
	const recipientEmail = typeof booking?.userEmail === 'string' ? booking.userEmail.trim().toLowerCase() : '';
	if (!recipientEmail) {
		return false;
	}

	try {
		await sendBookingCancellationEmail(recipientEmail, booking);
		return true;
	} catch (error) {
		console.error('Booking was cancelled, but cancellation email failed:', error);
		return false;
	}
}

async function sendAdminBookingAlertIfPossible(booking) {
	try {
		await sendAdminBookingAlertEmail(booking);
		return true;
	} catch (error) {
		console.error('Booking was created, but admin alert email failed:', error);
		return false;
	}
}

function requireVerifiedUser(req) {
	if (req.auth?.role === 'admin') {
		return;
	}

	return;
}

async function sendSubscriptionConfirmationIfPossible(subscription) {
	const recipientEmail = typeof subscription?.userEmail === 'string' ? subscription.userEmail.trim().toLowerCase() : '';
	if (!recipientEmail) {
		return false;
	}

	try {
		await sendSubscriptionConfirmationEmail(recipientEmail, subscription);
		return true;
	} catch (error) {
		console.error('Subscription was created, but confirmation email failed:', error);
		return false;
	}
}

router.post('/auth/verify-email-confirm', asyncHandler(async (req, res) => {
	const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

	if (!token) {
		throw new ApiError(400, 'token is required');
	}

	try {
		// Import the verifyJWTToken function
		const { verifyJWTToken } = require('./tokenUtils');
		
		// Decode the JWT to get the email
		const decoded = verifyJWTToken(token);
		
		if (!decoded || !decoded.email) {
			throw new ApiError(401, 'Invalid or expired verification token');
		}

		const email = decoded.email;

		// Verify the email using the database
		await verifyEmail(email, token);
		
		res.json({ 
			message: 'Email verified successfully',
			verified: true,
			email,
		});
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		throw new ApiError(400, 'Email verification failed: ' + (error.message || 'Unknown error'));
	}
}));

router.get('/auth/verify-email-check', asyncHandler(async (req, res) => {
	const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';

	if (!email) {
		throw new ApiError(400, 'email is required');
	}

	const verification = await checkEmailVerification(email);
	res.json(verification);
}));

router.post('/contact-messages', asyncHandler(async (req, res) => {
	const message = await createContactMessage(req.body || {});
	res.status(201).json({ message });
}));

router.get('/contact-messages-by-email', asyncHandler(async (req, res) => {
	const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
	if (!email) {
		return res.json({ messages: [] });
	}
	const messages = await listContactMessagesByEmail(email);
	res.json({ messages });
}));

router.get('/reviews', asyncHandler(async (req, res) => {
	const reviews = await listReviews(req.query?.limit);
	res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
	res.json({ reviews });
}));

router.post('/reviews', requireAuth, asyncHandler(async (req, res) => {
	const review = await createReview(req.body || {}, req.auth);
	res.status(201).json({ review });
}));

router.get('/settings', asyncHandler(async (_req, res) => {
	const settings = await getAppSettings();
	res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
	res.json({ settings });
}));

router.patch('/settings', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const settings = await updateAppSettings(req.body || {});
	res.json({ settings });
}));

router.get('/gallery', asyncHandler(async (req, res) => {
	const gallery = await getGalleryImages(req.query?.limit);
	res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
	res.json({ gallery });
}));

// ========== AUTHENTICATION ENDPOINTS ==========

router.post('/auth/register', asyncHandler(async (req, res) => {
	const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
	const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
	const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

	// Validation
	if (!name || !email || !password) {
		throw new ApiError(400, 'name, email, and password are required');
	}

	if (password.length < 6) {
		throw new ApiError(400, 'Password must be at least 6 characters');
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new ApiError(400, 'Invalid email format');
	}

	// Hash password
	const passwordHash = await bcryptjs.hash(password, 10);

	// Create user
	const user = await createUser(name, email, phone, passwordHash, 'user', true);

	const accessToken = generateAuthToken(user.id, user.email, user.name, user.role, user.emailVerified);
	const refreshToken = generateRefreshToken(user.id);

	res.cookie(env.jwtCookieName, accessToken, buildCookieOptions());

	res.status(201).json({
		message: 'Registration successful.',
		accessToken,
		refreshToken,
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			role: user.role,
			emailVerified: user.emailVerified,
		},
	});
}));

router.post('/auth/login', asyncHandler(async (req, res) => {
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
	const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
	const role = typeof req.body?.role === 'string' ? req.body.role.trim() : 'user';

	if (!email || !password) {
		throw new ApiError(400, 'email and password are required');
	}

	// Find user by email
	const user = await getUserByEmail(email);
	if (!user) {
		throw new ApiError(401, 'Invalid email or password');
	}

	// Check if password matches (temporary null-check for migration)
	if (!user.password_hash) {
		throw new ApiError(401, 'This account does not have a password set. Please contact support.');
	}

	// Verify password
	const passwordMatch = await bcryptjs.compare(password, user.password_hash);
	if (!passwordMatch) {
		throw new ApiError(401, 'Invalid email or password');
	}

	let verifiedUser = user;
	if (role !== 'admin' && !user.emailVerified) {
		try {
			verifiedUser = await markEmailVerified(email);
		} catch {
			verifiedUser = user;
		}
	}

	// Check role match if specified
	if (role !== 'any') {
		if (role === 'admin' && verifiedUser.role !== 'admin') {
			throw new ApiError(403, 'Admin access required');
		}

		if (role !== 'admin' && verifiedUser.role === 'admin') {
			throw new ApiError(403, 'This email is registered for admin access. Use the admin login page.');
		}

		if (role !== 'admin' && verifiedUser.role !== role) {
			throw new ApiError(403, `User is not a ${role}`);
		}
	}

	// Generate tokens
	const accessToken = generateAuthToken(verifiedUser.id, verifiedUser.email, verifiedUser.name, verifiedUser.role, verifiedUser.emailVerified);
	const refreshToken = generateRefreshToken(verifiedUser.id);

	// Set refresh token in httpOnly cookie
	res.cookie(env.jwtCookieName, accessToken, buildCookieOptions());

	res.json({
		accessToken,
		refreshToken,
		user: {
			id: verifiedUser.id,
			name: verifiedUser.name,
			email: verifiedUser.email,
			phone: verifiedUser.phone,
			role: verifiedUser.role,
			emailVerified: verifiedUser.emailVerified,
		},
	});
}));

router.post('/auth/verify-email-callback', asyncHandler(async (req, res) => {
	const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

	if (!token || !email) {
		throw new ApiError(400, 'token and email are required');
	}

	// Verify email in database
	await verifyEmail(email, token);

	// Mark email as verified in user profile
	const user = await markEmailVerified(email);

	// Generate auth token
	const accessToken = generateAuthToken(user.id, user.email, user.name, user.role, true);
	const refreshToken = generateRefreshToken(user.id);

	// Set token in cookie
	res.cookie(env.jwtCookieName, accessToken, buildCookieOptions());

	res.json({
		message: 'Email verified successfully',
		verified: true,
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

router.get('/auth/me', requireAuth, asyncHandler(async (req, res) => {
	const user = await getUserById(req.auth.sub);
	if (!user) {
		throw new ApiError(404, 'User not found');
	}

	res.json({
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			role: user.role,
			emailVerified: user.emailVerified,
		},
	});
}));

router.patch('/auth/profile', requireAuth, asyncHandler(async (req, res) => {
	const updates = {
		name: req.body?.name,
		phone: req.body?.phone,
		location: req.body?.location,
		photoUrl: req.body?.photoUrl,
	};

	const user = await updateUserProfile(req.auth.sub, updates);

	res.json({
		user: mapPublicUser(user),
	});
}));

router.post('/auth/profile/photo', requireAuth, asyncHandler(async (req, res) => {
	const imageDataUrl = typeof req.body?.image === 'string' ? req.body.image.trim() : '';

	if (!imageDataUrl.startsWith('data:image/')) {
		throw new ApiError(400, 'A valid image data URL is required');
	}

	const photoUrl = await resolveProfilePhotoUrl(imageDataUrl, req.auth.sub);
	const user = await updateUserProfile(req.auth.sub, { photoUrl });

	res.json({
		photoUrl,
		user: mapPublicUser(user),
	});
}));

router.post('/auth/change-password', requireAuth, asyncHandler(async (req, res) => {
	const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
	const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';

	if (!currentPassword || !newPassword) {
		throw new ApiError(400, 'currentPassword and newPassword are required');
	}

	if (newPassword.length < 6) {
		throw new ApiError(400, 'New password must be at least 6 characters');
	}

	// Get current user
	const user = await getUserById(req.auth.sub);
	if (!user || !user.password_hash) {
		throw new ApiError(400, 'Cannot change password for this account type');
	}

	// Verify current password
	const passwordMatch = await bcryptjs.compare(currentPassword, user.password_hash);
	if (!passwordMatch) {
		throw new ApiError(401, 'Current password is incorrect');
	}

	// Hash new password
	const newPasswordHash = await bcryptjs.hash(newPassword, 10);

	// Update password
	await updateUserPassword(req.auth.sub, newPasswordHash);

	res.json({
		message: 'Password changed successfully',
	});
}));

router.post('/auth/logout', requireAuth, asyncHandler(async (req, res) => {
	res.clearCookie(env.jwtCookieName);
	res.json({
		message: 'Logged out successfully',
	});
}));

router.post('/auth/refresh-token', asyncHandler(async (req, res) => {
	const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';

	if (!refreshToken) {
		throw new ApiError(400, 'refreshToken is required');
	}

	// Verify refresh token
	const { verifyRefreshToken } = require('./tokenUtils');
	const decoded = verifyRefreshToken(refreshToken);
	if (!decoded) {
		throw new ApiError(401, 'Invalid or expired refresh token');
	}

	// Get user
	const user = await getUserById(decoded.sub);
	if (!user) {
		throw new ApiError(404, 'User not found');
	}

	// Generate new access token
	const newAccessToken = generateAuthToken(user.id, user.email, user.name, user.role, user.emailVerified);
	const newRefreshToken = generateRefreshToken(user.id);

	// Set new token in cookie
	res.cookie(env.jwtCookieName, newAccessToken, buildCookieOptions());

	res.json({
		accessToken: newAccessToken,
		refreshToken: newRefreshToken,
	});
}));

// ========== ADMIN ROUTES ==========

router.post('/admin/gallery/upload', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const imageDataUrl = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
	const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';

	if (!imageDataUrl.startsWith('data:image/')) {
		throw new ApiError(400, 'A valid image data URL is required');
	}

	const upload = await uploadGalleryImage({ imageDataUrl, fileName });
	res.status(201).json({ upload });
}));

router.patch('/admin/gallery', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const gallery = await replaceGalleryImages(Array.isArray(req.body?.gallery) ? req.body.gallery : []);
	res.json({ gallery });
}));

router.delete('/admin/gallery/:imageId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const imageUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
	const imageCaption = typeof req.query?.caption === 'string' ? req.query.caption.trim() : '';
	const imageIndex = Number.parseInt(String(req.query?.index || ''), 10);
	const gallery = await deleteGalleryImage(req.params.imageId, imageUrl, imageCaption, imageIndex);
	res.json({ gallery });
}));

router.get('/availability', asyncHandler(async (req, res) => {
	const { date, court } = req.query;
	const availability = await getAvailability(date, court);
	res.json({ availability });
}));

router.get('/court-blocks', asyncHandler(async (_req, res) => {
	const blocks = await listCourtBlocks();
	res.json({ blocks });
}));

router.get('/bookings', requireAuth, asyncHandler(async (req, res) => {
	const bookings = await listBookings(req.auth, req.query || {});
	res.json({ bookings });
}));

router.post('/bookings', requireAuth, asyncHandler(async (req, res) => {
	requireVerifiedUser(req);

	const booking = await createBookingRecord({
		...req.body,
		source: 'user-app',
		userId: req.auth.sub,
		userName: req.body?.userName || req.auth.name,
		userEmail: req.body?.userEmail || req.auth.email,
		userPhone: req.body?.userPhone || null,
	});
	const [confirmationEmailSent, adminAlertEmailSent] = await Promise.all([
		sendBookingConfirmationIfPossible(booking),
		sendAdminBookingAlertIfPossible(booking),
	]);

	res.status(201).json({ booking: { ...booking, confirmationEmailSent, adminAlertEmailSent } });
}));

router.delete('/bookings/:bookingId', requireAuth, asyncHandler(async (req, res) => {
	const booking = await cancelBooking(req.auth, req.params.bookingId);
	const cancellationEmailSent = await sendBookingCancellationIfPossible(booking);
	res.json({ booking: { ...booking, cancellationEmailSent } });
}));

router.post('/subscriptions', requireAuth, asyncHandler(async (req, res) => {
	requireVerifiedUser(req);

	const subscription = await createSubscriptionRecord({
		...req.body,
		source: 'user-app',
		userId: req.auth.sub,
		userName: req.body?.userName || req.auth.name,
		userEmail: req.body?.userEmail || req.auth.email,
		userPhone: req.body?.userPhone || null,
	});
	const confirmationEmailSent = await sendSubscriptionConfirmationIfPossible(subscription);

	res.status(201).json({ subscription: { ...subscription, confirmationEmailSent } });
}));

router.get('/subscriptions', requireAuth, asyncHandler(async (req, res) => {
	const subscriptions = await listSubscriptions(req.auth, req.query || {});
	res.json({ subscriptions });
}));

router.delete('/subscriptions/:subscriptionId', requireAuth, asyncHandler(async (req, res) => {
	const subscription = await cancelSubscription(req.auth, req.params.subscriptionId);
	res.json({ subscription });
}));

router.get('/admin/dashboard/stats', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
	const stats = await getDashboardStats();
	res.json({ stats });
}));

router.get('/admin/dashboard/revenue', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const { month } = req.query;
	const revenue = await getRevenueSeries(month);
	res.json({ revenue });
}));

router.get('/admin/users', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
	const users = (await listUsers()).filter((user) => user.role !== 'admin');
	res.json({ users });
}));

router.delete('/admin/users/:userId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const result = await deleteUser(req.auth, req.params.userId);
	res.json(result);
}));

// Bulk delete routes have been removed to disable destructive admin operations.
// Admin delete routes removed to disable destructive operations from the API.

router.get('/admin/reviews', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
	const reviews = await listReviews();
	res.json({ reviews });
}));

router.patch('/admin/reviews/:reviewId/reply', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const review = await replyToReview(req.params.reviewId, req.body || {}, req.auth);
	res.json({ review });
}));

router.delete('/admin/reviews/:reviewId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const result = await deleteReview(req.params.reviewId, req.auth);
	res.json({ deleted: result });
}));

router.get('/admin/messages', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
	const messages = await listContactMessages();
	res.json({ messages });
}));

router.patch('/admin/messages/:messageId/reply', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const message = await replyToContactMessage(req.params.messageId, req.body || {}, req.auth);
	res.json({ message });
}));

router.post('/admin/bookings', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const booking = await createBookingRecord({
		...req.body,
		source: 'admin-desk',
		userId: await resolveAdminTargetUserId(req),
		userName: req.body?.userName || req.auth.name,
		userEmail: req.body?.userEmail || req.auth.email,
		userPhone: req.body?.userPhone || null,
	});
	const [confirmationEmailSent, adminAlertEmailSent] = await Promise.all([
		sendBookingConfirmationIfPossible(booking),
		sendAdminBookingAlertIfPossible(booking),
	]);

	res.status(201).json({ booking: { ...booking, confirmationEmailSent, adminAlertEmailSent } });
}));

router.get('/admin/court-blocks', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
	const blocks = await listCourtBlocks();
	res.json({ blocks });
}));

router.post('/admin/court-blocks', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const result = await createCourtBlockRecord(req.body || {}, req.auth);
	res.status(201).json(result);
}));

router.delete('/admin/court-blocks/:blockId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const result = await deleteCourtBlock(req.params.blockId, req.auth);
	res.json(result);
}));

router.delete('/admin/bookings/:bookingId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const booking = await cancelBooking(req.auth, req.params.bookingId);
	const cancellationEmailSent = await sendBookingCancellationIfPossible(booking);
	res.json({ booking: { ...booking, cancellationEmailSent } });
}));

// Admin booking delete route removed to disable destructive operations from the API.

router.patch('/admin/bookings/:bookingId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const booking = await updateBooking(req.auth, req.params.bookingId, req.body || {});
	res.json({ booking });
}));

router.post('/admin/subscriptions', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const subscription = await createSubscriptionRecord({
		...req.body,
		source: 'admin-desk',
		userId: await resolveAdminTargetUserId(req),
		userName: req.body?.userName || req.auth.name,
		userEmail: req.body?.userEmail || req.auth.email,
		userPhone: req.body?.userPhone || null,
	});
	const confirmationEmailSent = await sendSubscriptionConfirmationIfPossible(subscription);

	res.status(201).json({ subscription: { ...subscription, confirmationEmailSent } });
}));

router.delete('/admin/subscriptions/:subscriptionId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
	const subscription = await cancelSubscription(req.auth, req.params.subscriptionId);
	res.json({ subscription });
}));

router.patch('/admin/subscriptions/:subscriptionId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const subscription = await updateSubscription(req.auth, req.params.subscriptionId, req.body || {});
  res.json({ subscription });
}));

router.use((req, _res, next) => {
	next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

module.exports = router;
