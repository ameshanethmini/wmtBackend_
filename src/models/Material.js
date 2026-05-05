import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['fabric', 'accessory', 'etc'] },
    stockQty: { type: Number, required: true, default: 0 },
    unit: { type: String, default: 'pcs' },
    /** Unit cost / last price (LKR) — used for inventory value & manufacturing cost reference */
    unitPrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Material', materialSchema);
