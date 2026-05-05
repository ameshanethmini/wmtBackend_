import { ManufacturingJob, WashingTransfer, HourlyProduction } from '../models/index.js';
import { JOB_STATUS, assertTransition } from '../utils/statusMachine.js';
import { WASHING_STATUS } from '../models/WashingTransfer.js';

export async function getWashingView() {
  const [pending, received, completed, returned] = await Promise.all([
    WashingTransfer.find({ status: WASHING_STATUS.PENDING })
      .populate('jobId', 'jobNumber styleRef status productName')
      .sort({ createdAt: -1 })
      .lean(),
    WashingTransfer.find({ status: WASHING_STATUS.RECEIVED })
      .populate('jobId', 'jobNumber styleRef status productName')
      .sort({ createdAt: -1 })
      .lean(),
    WashingTransfer.find({ status: WASHING_STATUS.WASHING_COMPLETED })
      .populate('jobId', 'jobNumber styleRef status productName')
      .sort({ createdAt: -1 })
      .lean(),
    WashingTransfer.find({ status: WASHING_STATUS.RETURNED })
      .populate('jobId', 'jobNumber styleRef status productName')
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return { pending, received, completed, returned };
}

export async function getTransfersForJob(jobId) {
  return WashingTransfer.find({ jobId }).sort({ createdAt: -1 }).lean();
}

async function getProducedQty(jobId) {
  const agg = await HourlyProduction.aggregate([
    { $match: { jobId } },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ]);
  const hourly = agg[0]?.total ?? 0;
  if (hourly > 0) return hourly;
  const job = await ManufacturingJob.findById(jobId).lean();
  if (job?.assignedLines?.length) {
    return job.assignedLines.reduce((s, l) => s + (l.assignedQuantity || 0), 0);
  }
  return Number(job?.totalCutPieces || 0);
}

async function getSentQty(jobId) {
  const agg = await WashingTransfer.aggregate([
    { $match: { jobId } },
    { $group: { _id: null, total: { $sum: '$quantitySent' } } },
  ]);
  return agg[0]?.total ?? 0;
}

export async function getAvailableToSend(jobId) {
  const [produced, sent] = await Promise.all([getProducedQty(jobId), getSentQty(jobId)]);
  return Math.max(0, produced - sent);
}

export async function createTransfer(data) {
  const job = await ManufacturingJob.findById(data.jobId);
  if (!job) throw new Error('Job not found');

  const allowed = [
    JOB_STATUS.LINE_ASSIGNED,
    JOB_STATUS.LINE_IN_PROGRESS,
    JOB_STATUS.LINE_COMPLETED,
    JOB_STATUS.WASHING_OUT,
  ];
  if (!allowed.includes(job.status)) {
    throw new Error('Job must be in production or line-completed stage to send for washing');
  }

  const available = await getAvailableToSend(data.jobId);
  if (data.quantitySent > available) {
    throw new Error(`Only ${available} pieces available to send`);
  }
  if (data.quantitySent <= 0) throw new Error('Quantity must be > 0');

  const transfer = await WashingTransfer.create({
    jobId: data.jobId,
    quantitySent: data.quantitySent,
    sentFrom: data.sentFrom || '',
    washingCenter: data.washingCenter || '',
    notes: data.notes || '',
    status: WASHING_STATUS.PENDING,
  });

  if ([JOB_STATUS.LINE_COMPLETED, JOB_STATUS.LINE_ASSIGNED].includes(job.status)) {
    await ManufacturingJob.updateOne({ _id: data.jobId }, { $set: { status: JOB_STATUS.WASHING_OUT } });
  }

  return transfer.toObject();
}

export async function receiveTransfer(transferId) {
  const transfer = await WashingTransfer.findById(transferId);
  if (!transfer) throw new Error('Transfer not found');
  if (transfer.status !== WASHING_STATUS.PENDING) throw new Error('Only pending transfers can be received');
  transfer.status = WASHING_STATUS.RECEIVED;
  transfer.receivedAt = new Date();
  await transfer.save();
  return transfer.toObject();
}

export async function completeWashing(transferId) {
  const transfer = await WashingTransfer.findById(transferId).populate('jobId');
  if (!transfer) throw new Error('Transfer not found');
  if (transfer.status !== WASHING_STATUS.RECEIVED) throw new Error('Only received transfers can be completed');
  transfer.status = WASHING_STATUS.WASHING_COMPLETED;
  transfer.completedAt = new Date();
  await transfer.save();

  if (transfer.jobId) {
    await ManufacturingJob.updateOne(
      { _id: transfer.jobId._id },
      { $set: { status: JOB_STATUS.AFTER_WASH_RECEIVED } }
    );
  }
  return transfer.toObject();
}
