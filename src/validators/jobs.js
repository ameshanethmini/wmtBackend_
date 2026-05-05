import Joi from 'joi';
import { JOB_STATUS } from '../utils/statusMachine.js';

export const createJobSchema = Joi.object({
  materialId: Joi.string().hex().length(24).required(),
  issuedFabricQuantity: Joi.number().min(0.001).required(),
  styleRef: Joi.string().allow('', null),
  batchRef: Joi.string().allow('', null),
  accessories: Joi.any(),
});

export const cuttingSchema = Joi.object({
  fabricUsedQty: Joi.number().min(0).required(),
  fabricWasteQty: Joi.number().min(0).required(),
  totalCutPieces: Joi.number().integer().min(0).required(),
  cuttingRejectQty: Joi.number().integer().min(0).required(),
});

export const assignLinesSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  assignments: Joi.array()
    .items(
      Joi.object({
        lineName: Joi.string().required(),
        assignedQuantity: Joi.number().integer().min(0).required(),
        dispatchDate: Joi.date().optional(),
      })
    )
    .min(1)
    .required(),
  materialIssues: Joi.array()
    .items(
      Joi.object({
        materialId: Joi.string().hex().length(24).required(),
        quantityIssued: Joi.number().min(0.001).required(),
        issuedTo: Joi.string().allow('', null),
      })
    )
    .optional(),
});
