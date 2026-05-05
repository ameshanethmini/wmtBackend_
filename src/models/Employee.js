import mongoose from 'mongoose';
import { ROLE_VALUES, ROLES } from '../config/roles.js';

const employeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeId: { type: String, trim: true, default: undefined },
    productionSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionSection', default: null },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.OPERATOR,
    },
    salary: { type: Number, min: 0, default: 0 },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { timestamps: true }
);

employeeSchema.index({ userId: 1 }, { unique: true });
employeeSchema.index({ employeeId: 1 }, { unique: true, sparse: true });
employeeSchema.index({ productionSectionId: 1 });

export default mongoose.model('Employee', employeeSchema);
