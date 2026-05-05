import mongoose from 'mongoose';

const materialCatalogSchema = new mongoose.Schema(
  {
    materialCode: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ['fabric', 'accessory', 'packaging', 'thread', 'chemical', 'other'],
      default: 'other',
    },
    uom: {
      type: String,
      enum: ['meters', 'kg', 'pcs', 'rolls', 'liters', 'boxes'],
      default: 'pcs',
    },
    reorderLevel: { type: Number, default: 0, min: 0 },
    currentStock: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 }, // last known price
    preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  },
  { timestamps: true }
);

materialCatalogSchema.pre('validate', async function materialCodeAutogen(next) {
  if (this.materialCode) return next();

  let seed = (await mongoose.model('MaterialCatalog').countDocuments()) + 1;
  let candidate = `MAT-${String(seed).padStart(6, '0')}`;

  while (await mongoose.model('MaterialCatalog').exists({ materialCode: candidate })) {
    seed += 1;
    candidate = `MAT-${String(seed).padStart(6, '0')}`;
  }

  this.materialCode = candidate;
  next();
});

materialCatalogSchema.index({ name: 1 });
materialCatalogSchema.index({ category: 1 });
materialCatalogSchema.index({ materialCode: 1 }, { unique: true, sparse: true });
materialCatalogSchema.index(
  { name: 1, category: 1, uom: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export default mongoose.model('MaterialCatalog', materialCatalogSchema);
