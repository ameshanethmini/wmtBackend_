import mongoose from 'mongoose';

export const PACKING_STATUS = {
  PACKING: 'packing',
  SENT_TO_FINAL: 'sent_to_final',
  COMPLETED: 'completed',
};

const packingBatchSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', required: true },
    batchNumber: { type: String, required: true, unique: true },
    quantity: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ['good', 'damage'], default: 'good' },
    status: {
      type: String,
      enum: Object.values(PACKING_STATUS),
      default: PACKING_STATUS.PACKING,
    },
    packedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalCheckedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalCheckNotes: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

packingBatchSchema.index({ jobId: 1 });
packingBatchSchema.index({ status: 1 });

export default mongoose.model('PackingBatch', packingBatchSchema);
