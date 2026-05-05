import { Router } from 'express';
import * as productionController from '../controllers/productionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { hourlyProductionSchema } from '../validators/production.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'supervisor', 'operator'));

router.get('/hourly', productionController.listHourly);
router.get('/hourly/:jobId', productionController.getHourlyRecords);
router.post('/hourly', validate(hourlyProductionSchema), productionController.saveHourly);

export default router;
