import { ManufacturingJob, WashingTransfer, QcCheck, PackingBatch } from '../models/index.js';
import { JOB_STATUS } from '../utils/statusMachine.js';

export async function getOverview() {
  const [
    totalJobs,
    fabricIssuedCount,
    cuttingCount,
    lineCount,
    washingCount,
    packingCount,
    warehouseCount,
    recentJobs,
    pendingWashes,
    recentQc,
  ] = await Promise.all([
    ManufacturingJob.countDocuments(),
    ManufacturingJob.countDocuments({ status: JOB_STATUS.FABRIC_ISSUED }),
    ManufacturingJob.countDocuments({
      status: { $in: [JOB_STATUS.SENT_TO_CUTTING, JOB_STATUS.CUTTING_COMPLETED] },
    }),
    ManufacturingJob.countDocuments({
      status: { $in: [JOB_STATUS.LINE_ASSIGNED, JOB_STATUS.LINE_IN_PROGRESS, JOB_STATUS.LINE_COMPLETED] },
    }),
    ManufacturingJob.countDocuments({ status: JOB_STATUS.WASHING_OUT }),
    ManufacturingJob.countDocuments({
      status: { $in: [JOB_STATUS.AFTER_WASH_RECEIVED, JOB_STATUS.PACKING_COMPLETED] },
    }),
    ManufacturingJob.countDocuments({ status: JOB_STATUS.WAREHOUSE_RECEIVED }),
    ManufacturingJob.find().sort({ createdAt: -1 }).limit(10).lean(),
    WashingTransfer.countDocuments({ status: 'pending' }),
    QcCheck.find().sort({ checkedAt: -1 }).limit(5).populate('jobId', 'jobNumber').lean(),
  ]);

  return {
    kpis: {
      totalJobs,
      fabricIssuedCount,
      cuttingCount,
      lineCount,
      washingCount,
      packingCount,
      warehouseCount,
      pendingWashes,
    },
    recentJobs,
    recentQc,
  };
}
