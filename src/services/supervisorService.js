import { Employee, ProductionSection, ManufacturingJob, JobLineAssignment } from '../models/index.js';
import { JOB_STATUS } from '../utils/statusMachine.js';
import { assertTransition } from '../utils/statusMachine.js';

export async function getDashboard(userId) {
  const employee = await Employee.findOne({ userId })
    .populate('productionSectionId')
    .lean();
  if (!employee) {
    return { section: null, jobs: [], canCompleteLine: false };
  }
  const section = employee.productionSectionId;
  const isWashing = section?.slug === 'washing';
  const isLineSupervisor = employee.role === 'line_supervisor' || employee.role === 'admin';
  let jobs = [];
  if (isLineSupervisor && section?.type === 'line') {
    const lineName = section.name || section.slug;
    const jobIds = await JobLineAssignment.distinct('jobId', { lineName });
    jobs = await ManufacturingJob.find({
      _id: { $in: jobIds },
      status: { $in: [JOB_STATUS.LINE_ASSIGNED, JOB_STATUS.LINE_IN_PROGRESS] },
    })
      .populate('productId', 'name sku')
      .lean();
  }
  return {
    section,
    employee,
    jobs,
    canCompleteLine: isLineSupervisor && section?.type === 'line',
    isWashingSupervisor: employee.role === 'washing_supervisor',
  };
}

export async function completeLine(jobId, userId) {
  const employee = await Employee.findOne({ userId }).populate('productionSectionId');
  if (!employee) throw new Error('Employee record not found');
  const isLineSupervisor = employee.role === 'line_supervisor' || employee.role === 'admin';
  if (!isLineSupervisor) throw new Error('Only line supervisor can complete line');
  const job = await ManufacturingJob.findById(jobId);
  if (!job) throw new Error('Job not found');
  const lineName = employee.productionSectionId?.name || employee.productionSectionId?.slug;
  if (!lineName) throw new Error('Section has no line name');
  const assignment = await JobLineAssignment.findOne({ jobId, lineName });
  if (!assignment) throw new Error('Job is not assigned to your line');
  assertTransition(job.status, JOB_STATUS.LINE_COMPLETED);
  job.status = JOB_STATUS.LINE_COMPLETED;
  await job.save();
  return job.toObject();
}
