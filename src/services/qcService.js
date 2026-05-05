import { ManufacturingJob, QcCheck } from '../models/index.js';
import { JOB_STATUS } from '../utils/statusMachine.js';

export async function listQcJobs() {
  return ManufacturingJob.find({
    status: { $in: [JOB_STATUS.AFTER_WASH_RECEIVED, JOB_STATUS.PACKING_COMPLETED] },
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function getQcForJob(jobId) {
  const [job, checks] = await Promise.all([
    ManufacturingJob.findById(jobId).lean(),
    QcCheck.find({ jobId }).populate('checkedBy', 'name').sort({ checkedAt: -1 }).lean(),
  ]);
  if (!job) throw new Error('Job not found');
  return { job, checks };
}

export async function saveQc(jobId, data, userId) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');

  const check = await QcCheck.create({
    jobId,
    transferId: data.transferId || null,
    checkedBy: userId,
    totalChecked: data.totalChecked,
    passedQty: data.passedQty,
    failedQty: data.failedQty,
    defects: data.defects || [],
    result: data.result,
    stage: data.stage || 'post_washing',
    notes: data.notes || '',
    checkedAt: new Date(),
  });

  return check.toObject();
}

export async function markPackingComplete(jobId) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  if (job.status !== JOB_STATUS.AFTER_WASH_RECEIVED) {
    throw new Error('Job must be in AFTER_WASH_RECEIVED status');
  }
  job.status = JOB_STATUS.PACKING_COMPLETED;
  await job.save();
  return job.toObject();
}
