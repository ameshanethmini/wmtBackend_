import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be greater than 0.'],
    },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'credit_card'],
      default: 'cash',
    },
    isPettyCash: { type: Boolean, default: false },
    vendorName: { type: String, trim: true },
    receiptUrl: { type: String, trim: true },
    approvedBy: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['recorded', 'pending', 'approved', 'rejected'],
      default: 'pending',
    },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isRecurring: { type: Boolean, default: false },
    recurringMonth: { type: Number, default: null }, // 1-12 used to track "paid for month X"
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });

export default mongoose.model('Expense', expenseSchema);
