import mongoose from 'mongoose';

const hourlyProductionSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', required: true },
    lineName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    hour: { type: String, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

hourlyProductionSchema.index({ jobId: 1, recordedAt: -1 });

export default mongoose.model('HourlyProduction', hourlyProductionSchema);
