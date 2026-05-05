import mongoose from 'mongoose';

const aiPredictionLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['wastage', 'efficiency', 'job_summary', 'dashboard', 'suggestions', 'alerts'],
      required: true,
    },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', default: null },
    jobNumber: { type: String, default: null },
    input: { type: mongoose.Schema.Types.Mixed },
    output: { type: mongoose.Schema.Types.Mixed },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

aiPredictionLogSchema.index({ jobId: 1 });
aiPredictionLogSchema.index({ type: 1 });
aiPredictionLogSchema.index({ createdAt: -1 });

export default mongoose.model('AIPredictionLog', aiPredictionLogSchema);
