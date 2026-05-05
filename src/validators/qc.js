import Joi from 'joi';

export const saveQcSchema = Joi.object({
  finishedGoodQty: Joi.number().integer().min(0).required(),
  damagedQty: Joi.number().integer().min(0).required(),
  notes: Joi.string().allow('', null),
});

export const issueAccessorySchema = Joi.object({
  materialId: Joi.string().hex().length(24).required(),
  quantityIssued: Joi.number().min(0.001).required(),
  issuedTo: Joi.string().allow('', null),
});
