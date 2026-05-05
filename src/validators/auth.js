import Joi from 'joi';
import { ROLE_VALUES } from '../config/roles.js';

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'admin123',
  'letmein',
  'welcome123',
  'abc12345',
  'iloveyou',
  'changeme',
  'dermas123',
]);

const passwordSchema = Joi.string()
  .min(12)
  .max(128)
  .pattern(/[a-z]/, 'lowercase letter')
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'special character')
  .custom((value, helpers) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (COMMON_PASSWORDS.has(normalized)) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'common password guard')
  .messages({
    'string.min': 'Password must be at least 12 characters.',
    'string.max': 'Password must be at most 128 characters.',
    'string.pattern.name': 'Password must include at least one {#name}.',
    'any.invalid': 'Choose a stronger password that is not commonly used.',
  });

export const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

export const registerRequestSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  phoneNumber: Joi.string().trim().min(7).max(25).required(),
  password: passwordSchema.required(),
  reasonForAccess: Joi.string().trim().max(500).allow('').optional(),
});

export const approveRegistrationSchema = Joi.object({
  employeeId: Joi.string().trim().max(40).allow('').optional(),
  role: Joi.string().valid(...ROLE_VALUES).required(),
  productionSectionId: Joi.string().allow('', null).optional(),
});

export const rejectRegistrationSchema = Joi.object({
  rejectionReason: Joi.string().trim().max(500).allow('').optional(),
});

export const registrationStatusLookupSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  requestId: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordSchema.required(),
});
