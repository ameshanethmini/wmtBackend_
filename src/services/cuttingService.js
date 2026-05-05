import { ManufacturingJob } from '../models/index.js';
import { JOB_STATUS, assertTransition } from '../utils/statusMachine.js';

export async function listCuttingJobs() {
  return ManufacturingJob.find({
    status: { $in: [JOB_STATUS.SENT_TO_CUTTING, JOB_STATUS.CUTTING_COMPLETED] },
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function sendToCutting(jobId) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  assertTransition(job.status, JOB_STATUS.SENT_TO_CUTTING);
  job.status = JOB_STATUS.SENT_TO_CUTTING;
  await job.save();
  return job.toObject();
}

export async function saveCuttingRecord(jobId, data) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  assertTransition(job.status, JOB_STATUS.CUTTING_COMPLETED);

  job.fabricUsedQty = data.fabricUsedQty;
  job.fabricWasteQty = data.fabricWasteQty;
  job.totalCutPieces = data.totalCutPieces;
  job.cuttingRejectQty = data.cuttingRejectQty || 0;
  job.cuttingNotes = data.notes || '';
  job.status = JOB_STATUS.CUTTING_COMPLETED;
  await job.save();
  return job.toObject();
}
