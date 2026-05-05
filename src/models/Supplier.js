import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    supplierId: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 3 },
    ratingNote: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.pre('validate', async function supplierIdAutogen(next) {
  if (this.supplierId) return next();

  let seed = (await mongoose.model('Supplier').countDocuments()) + 1;
  let candidate = `SUP-${String(seed).padStart(6, '0')}`;

  while (await mongoose.model('Supplier').exists({ supplierId: candidate })) {
    seed += 1;
    candidate = `SUP-${String(seed).padStart(6, '0')}`;
  }

  this.supplierId = candidate;
  next();
});

supplierSchema.index({ name: 1 });
supplierSchema.index({ supplierId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Supplier', supplierSchema);
