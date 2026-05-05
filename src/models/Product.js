import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, unique: true, sparse: true },
    classification: { type: String, enum: ['normal', 'damage'], default: 'normal' },
    status: { type: String, enum: ['draft', 'active', 'inactive'], default: 'draft' },
    stockQty: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
