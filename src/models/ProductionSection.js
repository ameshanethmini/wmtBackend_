import mongoose from 'mongoose';

const productionSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, enum: ['line', 'department'] },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionSection', default: null },
    supervisorEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productionSectionSchema.index({ type: 1 });

export default mongoose.model('ProductionSection', productionSectionSchema);
