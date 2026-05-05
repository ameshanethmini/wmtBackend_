import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
	createRateLimiter,
	keyByIpAndEmail,
	keyByIpAndRequest,
} from '../middleware/rateLimit.js';
import {
	approveRegistrationSchema,
	forgotPasswordSchema,
	loginSchema,
	registrationStatusLookupSchema,
	registerRequestSchema,
	resetPasswordSchema,
	rejectRegistrationSchema,
} from '../validators/auth.js';

const router = Router();

const loginRateLimit = createRateLimiter({
	windowMs: 10 * 60 * 1000,
	max: 8,
	keyGenerator: keyByIpAndEmail('body'),
	message: 'Too many login attempts. Please try again in a few minutes.',
});

const forgotPasswordRateLimit = createRateLimiter({
	windowMs: 10 * 60 * 1000,
	max: 5,
	keyGenerator: keyByIpAndEmail('body'),
	message: 'Too many reset requests. Please try again shortly.',
});

const resetPasswordRateLimit = createRateLimiter({
	windowMs: 10 * 60 * 1000,
	max: 10,
	keyGenerator: keyByIpAndEmail('body'),
	message: 'Too many reset attempts. Please try again shortly.',
});

const requestStatusRateLimit = createRateLimiter({
	windowMs: 10 * 60 * 1000,
	max: 12,
	keyGenerator: keyByIpAndRequest('query'),
	message: 'Too many status checks. Please try again shortly.',
});

router.post('/login', loginRateLimit, validate(loginSchema), authController.login);
router.post('/register', validate(registerRequestSchema), authController.register);
router.post('/register-request', validate(registerRequestSchema), authController.createRegistrationRequest);
router.get('/registration-requests/status', requestStatusRateLimit, validate(registrationStatusLookupSchema, 'query'), authController.lookupRegistrationRequestStatus);
router.post('/forgot-password', forgotPasswordRateLimit, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', resetPasswordRateLimit, validate(resetPasswordSchema), authController.resetPassword);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);
router.post('/bootstrap-admin', (req, res, next) => {
	if (process.env.NODE_ENV === 'production') {
		return res.status(404).json({ error: 'Not found' });
	}
	return authController.bootstrapAdmin(req, res, next);
});

router.get('/registration-requests', requireAuth, requireRole('admin'), authController.listRegistrationRequests);
router.get('/registration-requests/:id', requireAuth, requireRole('admin'), authController.getRegistrationRequestDetail);
router.post(
	'/registration-requests/:id/approve',
	requireAuth,
	requireRole('admin'),
	validate(approveRegistrationSchema),
	authController.approveRegistrationRequest
);
router.post(
	'/registration-requests/:id/reject',
	requireAuth,
	requireRole('admin'),
	validate(rejectRegistrationSchema),
	authController.rejectRegistrationRequest
);

export default router;
