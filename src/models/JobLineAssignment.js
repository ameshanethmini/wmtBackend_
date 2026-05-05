import mongoose from 'mongoose';

const jobLineAssignmentSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', required: true },
    lineName: { type: String, required: true },
    assignedQuantity: { type: Number, required: true },
    dispatchDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

jobLineAssignmentSchema.index({ jobId: 1 });

export default mongoose.model('JobLineAssignment', jobLineAssignmentSchema);
