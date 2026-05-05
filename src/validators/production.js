import Joi from 'joi';

export const hourlyProductionSchema = Joi.object({
  jobId: Joi.string().hex().length(24).required(),
  rows: Joi.array()
    .items(
      Joi.object({
        lineName: Joi.string().required(),
        productionDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        hour: Joi.number().integer().min(0).max(23).required(),
        employeeId: Joi.string().hex().length(24).required(),
        quantity: Joi.number().integer().min(0).required(),
      })
    )
    .min(1)
    .required(),
});
