import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['rent', 'electricity', 'salaries', 'maintenance', 'internet', 'transport', 'other'],
      default: 'other',
    },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', default: null },
    description: { type: String, trim: true },
    isRecurring: { type: Boolean, default: false },
    recurringDay: { type: Number, min: 1, max: 31, default: null },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

expenseCategorySchema.index({ name: 1, parentCategory: 1 }, { unique: true });

export default mongoose.model('ExpenseCategory', expenseCategorySchema);
