import { Router } from 'express';
import { getNextEmployeeId } from '../controllers/accountRequestController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/next-employee-id', requireAuth, requireRole('admin'), getNextEmployeeId);

export default router;
