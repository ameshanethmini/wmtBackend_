import Joi from 'joi';

const phonePattern = /^\+?[0-9()\-\s]{7,20}$/;

export const updateAccountProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  phone: Joi.string().trim().pattern(phonePattern).required(),
  address: Joi.string().trim().allow('').max(500).optional(),
  dateOfBirth: Joi.date().iso().allow('', null).optional(),
  profilePhoto: Joi.string()
    .trim()
    .allow('')
    .custom((value, helpers) => {
      if (!value) return value;
      if (/^https?:\/\//i.test(value)) return value;
      if (/^data:image\/(jpeg|png);base64,/i.test(value)) return value;
      return helpers.error('string.uri');
    }, 'profile photo uri or data url validation')
    .optional(),
});

export const updateAccountPasswordSchema = Joi.object({
  currentPassword: Joi.string().allow('').optional(),
  newPassword: Joi.string().min(8).allow('').optional(),
  confirmPassword: Joi.string().allow('').optional(),
});

export const updateAccountPreferencesSchema = Joi.object({
  emailNotifications: Joi.boolean().required(),
  systemAlerts: Joi.boolean().required(),
  darkMode: Joi.boolean().required(),
});
