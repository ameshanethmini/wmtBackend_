import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', required: true },
    movementType: {
      type: String,
      enum: ['grn', 'adjustment_add', 'adjustment_sub', 'issuance', 'manual'],
      required: true,
    },
    quantity: { type: Number, required: true }, // positive = stock IN, negative = stock OUT
    referenceId: { type: String, default: '' },   // GRN number, adjustment _id, etc.
    referenceType: { type: String, default: '' }, // 'GoodsReceivedNote', 'StockAdjustment', etc.
    note: { type: String, trim: true },
    performedBy: { type: String, trim: true, default: 'System' },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

stockMovementSchema.index({ material: 1, createdAt: -1 });
stockMovementSchema.index({ movementType: 1 });
stockMovementSchema.index({ createdAt: -1 });

export default mongoose.model('StockMovement', stockMovementSchema);
