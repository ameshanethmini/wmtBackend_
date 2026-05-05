import mongoose from 'mongoose';

const qcDefectSchema = new mongoose.Schema(
  {
    defectType: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    severity: { type: String, enum: ['minor', 'major', 'critical'], default: 'minor' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const qcCheckSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', required: true },
    transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'WashingTransfer', default: null },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalChecked: { type: Number, required: true, min: 1 },
    passedQty: { type: Number, required: true, min: 0 },
    failedQty: { type: Number, required: true, min: 0 },
    defects: [qcDefectSchema],
    result: { type: String, enum: ['pass', 'fail', 'conditional'], required: true },
    stage: {
      type: String,
      enum: ['inline', 'post_washing', 'final'],
      default: 'post_washing',
    },
    notes: { type: String, default: '' },
    checkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

qcCheckSchema.index({ jobId: 1 });
qcCheckSchema.index({ checkedAt: -1 });

export default mongoose.model('QcCheck', qcCheckSchema);
