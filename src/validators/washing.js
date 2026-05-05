import Joi from 'joi';

export const createTransferSchema = Joi.object({
  jobId: Joi.string().hex().length(24).allow(null),
  quantitySent: Joi.number().integer().min(1).required(),
  sentFrom: Joi.string().allow('', null),
});
