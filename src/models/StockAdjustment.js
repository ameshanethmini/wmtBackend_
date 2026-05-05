import mongoose from 'mongoose';

const stockAdjustmentSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', required: true },
    adjustmentType: { type: String, enum: ['add', 'subtract'], required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    reason: {
      type: String,
      enum: ['damaged', 'audit_correction', 'expired', 'returned', 'found', 'other'],
      required: true,
    },
    note: { type: String, trim: true },
    adjustedBy: { type: String, required: true, trim: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
  },
  { timestamps: true }
);

stockAdjustmentSchema.index({ material: 1 });
stockAdjustmentSchema.index({ createdAt: -1 });

export default mongoose.model('StockAdjustment', stockAdjustmentSchema);
