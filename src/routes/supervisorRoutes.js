import { Router } from 'express';
import * as supervisorController from '../controllers/supervisorController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSupervisorOfLine } from '../middleware/supervisor.js';

const router = Router();

router.use(requireAuth);

router.get('/dashboard', supervisorController.getDashboard);
router.post('/lines/:jobId/complete', requireSupervisorOfLine, supervisorController.completeLine);

export default router;
