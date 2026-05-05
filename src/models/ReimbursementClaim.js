import mongoose from 'mongoose';

const reimbursementClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, trim: true, default: null },
    employeeName: { type: String, required: true, trim: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ['travel', 'meal', 'other'],
      default: 'other',
    },
    expenseDate: { type: Date, default: Date.now },
    submittedDate: { type: Date, default: Date.now },
    description: { type: String, required: true, trim: true },
    receiptUrl: { type: String, trim: true },
    paymentMethod: { type: String, trim: true, default: '' },
    approvedBy: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, trim: true },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reimbursementClaimSchema.index({ status: 1 });
reimbursementClaimSchema.index({ createdAt: -1 });
reimbursementClaimSchema.index({ expenseDate: -1 });
reimbursementClaimSchema.index({ claimId: 1 }, { unique: true, sparse: true });

export default mongoose.model('ReimbursementClaim', reimbursementClaimSchema);
