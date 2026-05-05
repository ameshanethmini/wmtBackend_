import { ManufacturingJob } from '../models/index.js';

export async function getNextJobNumber() {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const prefix = `MFG-${year}${month}-`;

  const last = await ManufacturingJob.findOne(
    { jobNumber: { $regex: `^${prefix}` } },
    { jobNumber: 1 },
    { sort: { jobNumber: -1 } }
  ).lean();

  let seq = 1;
  if (last) {
    const parts = last.jobNumber.split('-');
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}
