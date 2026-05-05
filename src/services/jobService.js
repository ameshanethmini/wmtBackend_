import { ManufacturingJob, HourlyProduction, ProductionSection, Product } from '../models/index.js';
import { JOB_STATUS, assertTransition } from '../utils/statusMachine.js';
import { getNextJobNumber } from '../utils/jobNumber.js';

export async function listJobs(filters = {}) {
  const query = {};

  if (filters.status) {
    let statuses = filters.status;
    if (typeof statuses === 'string' && statuses.includes(',')) {
      statuses = statuses.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(statuses)) {
      query.status = { $in: statuses };
    } else {
      query.status = statuses;
    }
  }
  if (filters.search) {
    query.$or = [
      { jobNumber: { $regex: filters.search, $options: 'i' } },
      { styleRef: { $regex: filters.search, $options: 'i' } },
      { productName: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const jobs = await ManufacturingJob.find(query)
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  if (jobs.length) {
    const jobIds = jobs.map((j) => j._id);
    const producedAgg = await HourlyProduction.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: '$jobId', totalQty: { $sum: '$quantity' } } },
    ]);
    const producedMap = new Map(producedAgg.map((a) => [String(a._id), a.totalQty]));
    for (const job of jobs) {
      const produced = producedMap.get(String(job._id)) ?? 0;
      job.producedQty = produced;
      job.remainingQty =
        job.totalCutPieces != null ? Math.max(0, job.totalCutPieces - produced) : null;
    }
  }

  return jobs;
}

export async function getJob(jobId) {
  const job = await ManufacturingJob.findById(jobId)
    .populate('createdBy', 'name email')
    .lean();
  if (!job) throw new Error('Job not found');

  const [producedAgg, hourlyLogs] = await Promise.all([
    HourlyProduction.aggregate([
      { $match: { jobId: job._id } },
      { $group: { _id: '$jobId', totalQty: { $sum: '$quantity' } } },
    ]),
    HourlyProduction.find({ jobId: job._id }).sort({ recordedAt: -1 }).limit(20).lean(),
  ]);

  const producedQty = producedAgg[0]?.totalQty ?? 0;
  const remainingQty =
    job.totalCutPieces != null ? Math.max(0, job.totalCutPieces - producedQty) : null;

  return { ...job, producedQty, remainingQty, hourlyLogs };
}

export async function createJob(data, userId, startupAttachment = null) {
  const jobNumber = await getNextJobNumber();
  const job = await ManufacturingJob.create({
    jobNumber,
    styleRef: data.styleRef || '',
    batchRef: data.batchRef || '',
    productName: data.productName || '',
    productSku: data.productSku || '',
    fabricType: data.fabricType || '',
    color: data.color || '',
    issuedFabricQuantity: data.issuedFabricQuantity,
    status: JOB_STATUS.FABRIC_ISSUED,
    createdBy: userId,
    startupAttachment: startupAttachment || undefined,
    notes: data.notes || '',
  });
  return job.toObject();
}

export async function updateJobStatus(jobId, newStatus) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  assertTransition(job.status, newStatus);
  job.status = newStatus;
  await job.save();
  return job.toObject();
}

export async function addHourlyProduction(jobId, data, userId) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  if (![JOB_STATUS.LINE_ASSIGNED, JOB_STATUS.LINE_IN_PROGRESS].includes(job.status)) {
    throw new Error('Job must be in LINE_ASSIGNED or LINE_IN_PROGRESS status');
  }
  if (job.status === JOB_STATUS.LINE_ASSIGNED) {
    job.status = JOB_STATUS.LINE_IN_PROGRESS;
    await job.save();
  }
  const record = await HourlyProduction.create({
    jobId,
    lineName: data.lineName,
    quantity: data.quantity,
    hour: data.hour || new Date().toISOString(),
    recordedBy: userId,
    notes: data.notes || '',
  });
  return record.toObject();
}

export async function sendToCutting(jobId) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  assertTransition(job.status, JOB_STATUS.SENT_TO_CUTTING);
  job.status = JOB_STATUS.SENT_TO_CUTTING;
  await job.save();
  return job.toObject();
}

export async function getAssignLinesMeta() {
  const [lines, products] = await Promise.all([
    ProductionSection.find({ isActive: true }).sort({ name: 1 }).lean().catch(() => []),
    Product.find({ status: 'active' }).sort({ name: 1 }).lean().catch(() => []),
  ]);
  return { lines, products };
}

export async function assignLines(jobId, data) {
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  assertTransition(job.status, JOB_STATUS.LINE_ASSIGNED);

  job.assignedLines = data.assignments.map((a) => ({
    lineName: a.lineName,
    assignedQuantity: a.assignedQuantity,
    dispatchDate: a.dispatchDate || new Date(),
  }));
  job.productName = data.productName || job.productName;
  job.status = JOB_STATUS.LINE_ASSIGNED;
  await job.save();
  return job.toObject();
}

// ── Line master CRUD (for manufacturing assignment) ───────────
export async function listLines({ includeInactive = false } = {}) {
  const query = { type: 'line' };
  if (!includeInactive) query.isActive = true;
  return ProductionSection.find(query).sort({ name: 1 }).lean();
}

export async function createLine(data = {}) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Line name is required');

  const slug = String(data.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) throw new Error('Line slug is required');

  const exists = await ProductionSection.findOne({ slug }).lean();
  if (exists) throw new Error('Line slug already exists');

  const created = await ProductionSection.create({
    name,
    slug,
    type: 'line',
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
  });
  return created.toObject();
}

export async function updateLine(id, data = {}) {
  const line = await ProductionSection.findById(id);
  if (!line || line.type !== 'line') throw new Error('Line not found');

  if (data.name !== undefined) {
    const name = String(data.name || '').trim();
    if (!name) throw new Error('Line name is required');
    line.name = name;
  }
  if (data.slug !== undefined) {
    const slug = String(data.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
    if (!slug) throw new Error('Line slug is required');
    const exists = await ProductionSection.findOne({ slug, _id: { $ne: line._id } }).lean();
    if (exists) throw new Error('Line slug already exists');
    line.slug = slug;
  }
  if (data.isActive !== undefined) line.isActive = Boolean(data.isActive);

  await line.save();
  return line.toObject();
}

export async function deleteLine(id) {
  const line = await ProductionSection.findById(id);
  if (!line || line.type !== 'line') throw new Error('Line not found');
  await ProductionSection.deleteOne({ _id: line._id });
  return { ok: true };
}
