import { ManufacturingJob, HourlyProduction, JobLineAssignment } from '../models/index.js';
import { JOB_STATUS } from '../utils/statusMachine.js';

const LEGACY_SUPERVISOR_ROLES = ['line_supervisor', 'washing_supervisor', 'cutting_supervisor'];

export async function listJobsForHourlyProduction(userEmployee) {
  const query = { status: { $in: [JOB_STATUS.LINE_ASSIGNED, JOB_STATUS.LINE_IN_PROGRESS] } };
  if (
    userEmployee?.productionSectionId &&
    (userEmployee.role === 'supervisor' || LEGACY_SUPERVISOR_ROLES.includes(userEmployee.role))
  ) {
    const section = userEmployee.productionSectionId;
    const lineName = section?.name || section?.slug;
    if (lineName) {
      const jobsWithLine = await ManufacturingJob.find(query)
        .populate('productId', 'name sku')
        .lean();
      const lineAssignments = await JobLineAssignment.find({ lineName }).distinct('jobId');
      return jobsWithLine.filter((j) => lineAssignments.some((id) => id.equals(j._id)));
    }
  }
  return ManufacturingJob.find(query)
    .populate('productId', 'name sku')
    .sort({ updatedAt: -1 })
    .lean();
}

export async function saveHourlyProduction(data) {
  const job = await ManufacturingJob.findById(data.jobId);
  if (!job) throw new Error('Job not found');
  if (![JOB_STATUS.LINE_ASSIGNED, JOB_STATUS.LINE_IN_PROGRESS].includes(job.status)) {
    throw new Error('Job must be LINE_ASSIGNED or LINE_IN_PROGRESS to record hourly production');
  }

  // Lock rule: once any record exists for (jobId + lineName + productionDate + hour),
  // that time slot becomes locked and cannot be edited again.
  const rows = (data.rows || []).map((r) => ({
    lineName: r.lineName,
    productionDate: r.productionDate,
    hour: Number(r.hour),
    employeeId: r.employeeId,
    quantity: r.quantity,
  }));

  // Deduplicate by employee within the same time slot.
  const deduped = new Map();
  for (const r of rows) {
    const k = `${r.lineName}|${r.productionDate}|${r.hour}|${r.employeeId}`;
    if (!deduped.has(k)) deduped.set(k, r);
  }
  const finalRows = Array.from(deduped.values());

  const hourKeys = new Map(); // key -> { lineName, productionDate, hour }
  for (const r of finalRows) {
    const k = `${r.lineName}|${r.productionDate}|${r.hour}`;
    if (!hourKeys.has(k)) {
      hourKeys.set(k, { lineName: r.lineName, productionDate: r.productionDate, hour: r.hour });
    }
  }

  const keys = Array.from(hourKeys.values());
  const existing = keys.length
    ? await HourlyProduction.find({
        jobId: data.jobId,
        $or: keys.map((k) => ({
          lineName: k.lineName,
          productionDate: k.productionDate,
          hour: k.hour,
        })),
      })
        .select({ _id: 1 })
        .lean()
    : [];

  if (existing.length > 0) {
    const err = new Error('This time slot is locked. You cannot edit production for the same hour.');
    err.status = 409;
    throw err;
  }

  await HourlyProduction.insertMany(
    finalRows.map((r) => ({
      jobId: data.jobId,
      lineName: r.lineName,
      productionDate: r.productionDate,
      hour: r.hour,
      employeeId: r.employeeId,
      quantity: r.quantity,
    })),
  );
  if (job.status === JOB_STATUS.LINE_ASSIGNED) {
    job.status = JOB_STATUS.LINE_IN_PROGRESS;
    await job.save();
  }
  return { ok: true };
}

export async function getHourlyRecords(jobId, userEmployee) {
  const query = { jobId };

  // Line supervisor should only see records for their assigned line/section.
  if (
    userEmployee?.productionSectionId &&
    (userEmployee.role === 'supervisor' || LEGACY_SUPERVISOR_ROLES.includes(userEmployee.role))
  ) {
    const section = userEmployee.productionSectionId;
    const lineName = section?.name || section?.slug;
    if (lineName) query.lineName = lineName;
  }

  return HourlyProduction.find(query)
    .sort({ productionDate: 1, hour: 1 })
    .lean();
}
