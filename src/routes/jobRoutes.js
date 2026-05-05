import { Router } from 'express';
import * as jobController from '../controllers/jobController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createJobSchema, assignLinesSchema } from '../validators/jobs.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'supervisor'));

router.get('/', jobController.list);
router.post('/', validate(createJobSchema), jobController.create);
router.get('/:jobId', jobController.getOne);
router.post('/:jobId/send-to-cutting', jobController.sendToCutting);
router.get('/:jobId/assign-lines/meta', jobController.getAssignLinesMeta);
router.post('/:jobId/assign-lines', validate(assignLinesSchema), jobController.assignLines);

export default router;
