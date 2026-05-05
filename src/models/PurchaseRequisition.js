import mongoose from 'mongoose';

const requisitionItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', required: true },
  qty: { type: Number, required: true, min: 1 },
  note: { type: String, trim: true },
}, { _id: false });

const purchaseRequisitionSchema = new mongoose.Schema(
  {
    requestedBy: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    items: [requisitionItemSchema],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    approvedBy: { type: String, trim: true },
    approvalNote: { type: String, trim: true },
    approvedAt: { type: Date, default: null },
    linkedPO: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  },
  { timestamps: true }
);

purchaseRequisitionSchema.index({ status: 1 });
purchaseRequisitionSchema.index({ createdAt: -1 });

export default mongoose.model('PurchaseRequisition', purchaseRequisitionSchema);
