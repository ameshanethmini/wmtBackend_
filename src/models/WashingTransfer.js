import mongoose from 'mongoose';

export const WASHING_STATUS = {
  PENDING: 'pending',
  RECEIVED: 'received',
  WASHING_COMPLETED: 'washing_completed',
  RETURNED: 'returned',
};

const washingTransferSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', required: true },
    quantitySent: { type: Number, required: true, min: 1 },
    quantityReceived: { type: Number, default: null },
    sentFrom: { type: String, trim: true, default: '' },
    washingCenter: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: Object.values(WASHING_STATUS),
      default: WASHING_STATUS.PENDING,
    },
    sentAt: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

washingTransferSchema.index({ jobId: 1 });
washingTransferSchema.index({ status: 1 });

export default mongoose.model('WashingTransfer', washingTransferSchema);
