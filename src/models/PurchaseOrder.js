import mongoose from 'mongoose';

const poItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', default: null },
  description: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

// Auto-generate PO number
let poCounter = 1;

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    requisition: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseRequisition', default: null },
    items: [poItemSchema],
    status: {
      type: String,
      enum: ['draft', 'sent', 'shipped', 'received', 'cancelled'],
      default: 'draft',
    },
    totalAmount: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    expectedDeliveryDate: { type: Date, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

purchaseOrderSchema.pre('save', async function (next) {
  if (!this.poNumber) {
    const count = await mongoose.model('PurchaseOrder').countDocuments();
    this.poNumber = `PO-${String(count + 1).padStart(4, '0')}`;
  }
  this.totalAmount = this.items.reduce((s, i) => s + i.totalPrice, 0);
  next();
});

purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ supplier: 1 });

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
