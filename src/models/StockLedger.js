import mongoose from 'mongoose';

const stockLedgerSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    transactionType: {
      type: String,
      required: true,
      enum: ['transfer_in', 'transfer_out', 'adjustment', 'sale'],
    },
    quantity: { type: Number, required: true },
    referenceType: { type: String, trim: true },
    referenceId: { type: mongoose.Schema.Types.Mixed },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

stockLedgerSchema.index({ productId: 1 });
stockLedgerSchema.index({ referenceType: 1, referenceId: 1 });

export default mongoose.model('StockLedger', stockLedgerSchema);
