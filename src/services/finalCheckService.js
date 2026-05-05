import { ManufacturingJob, PackingBatch, Product } from '../models/index.js';
import { JOB_STATUS } from '../utils/statusMachine.js';
import { PACKING_STATUS } from '../models/PackingBatch.js';

/** Sum good packing batches; fall back to cut pieces − rejects, then producedQty. */
async function computeFinishedGoodQty(job) {
  const agg = await PackingBatch.aggregate([
    { $match: { jobId: job._id, type: 'good' } },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ]);
  let qty = agg[0]?.total ?? 0;
  if (qty <= 0 && job.totalCutPieces != null) {
    const rejects = Number(job.cuttingRejectQty) || 0;
    qty = Math.max(0, Number(job.totalCutPieces) - rejects);
  }
  if (qty <= 0 && job.producedQty) {
    qty = Math.max(0, Number(job.producedQty));
  }
  return qty;
}

/**
 * When a job reaches warehouse, upsert the Product catalog and increase stock.
 * SKU = job.productSku or MFG-{jobNumber} so each job has a stable key.
 */
async function syncFinishedGoodsToCatalog(job) {
  const addQty = await computeFinishedGoodQty(job);
  const sku = (job.productSku && String(job.productSku).trim()) || `MFG-${job.jobNumber}`;
  const name =
    (job.productName && String(job.productName).trim()) ||
    (job.styleRef && String(job.styleRef).trim()) ||
    job.jobNumber;

  if (addQty <= 0) {
    return { synced: false, sku, name, addQty: 0, reason: 'no_quantity' };
  }

  try {
    const doc = await Product.findOneAndUpdate(
      { sku },
      {
        $setOnInsert: { name, classification: 'normal', status: 'active' },
        $inc: { stockQty: addQty },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    return {
      synced: true,
      sku,
      name,
      addQty,
      productId: String(doc._id),
      stockQty: doc.stockQty,
    };
  } catch (err) {
    return { synced: false, sku, name, addQty, error: err.message };
  }
}

export async function listFinalJobs() {
  return ManufacturingJob.find({
    status: { $in: [JOB_STATUS.PACKING_COMPLETED] },
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function getFinalJobDetail(jobId) {
  const [job, batches] = await Promise.all([
    ManufacturingJob.findById(jobId).lean(),
    PackingBatch.find({ jobId }).sort({ createdAt: -1 }).populate('packedBy', 'name').lean(),
  ]);
  if (!job) throw new Error('Job not found');
  return { job, batches };
}

export async function createPackingBatch(jobId, data, userId) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  if (![JOB_STATUS.AFTER_WASH_RECEIVED, JOB_STATUS.PACKING_COMPLETED].includes(job.status)) {
    throw new Error('Job must be in AFTER_WASH_RECEIVED or PACKING_COMPLETED status');
  }

  const batchCount = await PackingBatch.countDocuments({ jobId });
  const batchNumber = `${job.jobNumber}-BATCH-${String(batchCount + 1).padStart(3, '0')}`;

  const batch = await PackingBatch.create({
    jobId,
    batchNumber,
    quantity: data.quantity,
    type: data.type || 'good',
    packedBy: userId,
    notes: data.notes || '',
  });
  return batch.toObject();
}

export async function finalizeJob(jobId, userId) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  if (job.status !== JOB_STATUS.PACKING_COMPLETED) {
    throw new Error('Job must be in PACKING_COMPLETED status');
  }
  job.status = JOB_STATUS.WAREHOUSE_RECEIVED;
  await job.save();

  await PackingBatch.updateMany(
    { jobId, status: PACKING_STATUS.PACKING },
    { $set: { status: PACKING_STATUS.COMPLETED, finalCheckedBy: userId, completedAt: new Date() } }
  );

  const catalogSync = await syncFinishedGoodsToCatalog(job);
  const jobOut = job.toObject();
  return { ...jobOut, catalogSync };
}
