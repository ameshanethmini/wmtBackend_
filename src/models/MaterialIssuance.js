import mongoose from 'mongoose';

const materialIssuanceSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', required: true },
    issuedTo: { type: String, required: true, trim: true },   // e.g. "Cutting Line 1"
    issuedBy: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    jobReference: { type: String, trim: true, default: '' }, // optional job/order number
    note: { type: String, trim: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
  },
  { timestamps: true }
);

materialIssuanceSchema.index({ material: 1 });
materialIssuanceSchema.index({ createdAt: -1 });

export default mongoose.model('MaterialIssuance', materialIssuanceSchema);
