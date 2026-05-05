import { Router } from 'express';
import * as ctrl from '../controllers/manufacturingController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadJobAttachment } from '../middleware/upload.js';

const router = Router();

router.use(requireAuth);

// Overview
router.get('/overview', ctrl.getOverview);

// Jobs
router.get('/jobs', ctrl.listJobs);
router.post('/jobs', uploadJobAttachment.single('attachment'), ctrl.createJob);
router.get('/jobs/:jobId', ctrl.getJob);
router.patch('/jobs/:jobId/status', ctrl.updateJobStatus);
router.post('/jobs/:jobId/assign-lines', ctrl.assignLines);
router.post('/jobs/:jobId/hourly-production', ctrl.addHourlyProduction);
router.get('/jobs/:jobId/transfers', ctrl.getJobTransfers);
router.get('/lines', ctrl.listLines);
router.post('/lines', ctrl.createLine);
router.put('/lines/:id', ctrl.updateLine);
router.delete('/lines/:id', ctrl.deleteLine);

// Cutting
router.get('/cutting', ctrl.listCutting);
router.post('/cutting/:jobId/send', ctrl.sendToCutting);
router.post('/cutting/:jobId/save', ctrl.saveCutting);

// Washing
router.get('/washing', ctrl.getWashing);
router.post('/washing/transfers', ctrl.createTransfer);
router.post('/washing/transfers/:id/receive', ctrl.receiveTransfer);
router.post('/washing/transfers/:id/complete', ctrl.completeWashing);

// QC
router.get('/qc', ctrl.listQc);
router.get('/qc/:jobId', ctrl.getQcForJob);
router.post('/qc/:jobId', ctrl.saveQc);
router.post('/qc/:jobId/packing-complete', ctrl.markPackingComplete);

// Final Check
router.get('/final', ctrl.listFinal);
router.get('/final/:jobId', ctrl.getFinalJobDetail);
router.post('/final/:jobId/batches', ctrl.createPackingBatch);
router.post('/final/:jobId/finalize', ctrl.finalizeJob);

export default router;
