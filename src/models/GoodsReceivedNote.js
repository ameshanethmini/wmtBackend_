import mongoose from 'mongoose';

const grnItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', default: null },
  description: { type: String, trim: true },
  orderedQty: { type: Number, required: true, min: 0 },
  receivedQty: { type: Number, required: true, min: 0 },
  qcStatus: { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' },
  qcNote: { type: String, trim: true },
}, { _id: false });

const goodsReceivedNoteSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, unique: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    receivedDate: { type: Date, default: Date.now },
    receivedBy: { type: String, required: true, trim: true },
    items: [grnItemSchema],
    overallQcStatus: {
      type: String,
      enum: ['pass', 'partial', 'fail', 'pending'],
      default: 'pending',
    },
    // Payment
    invoiceNumber: { type: String, trim: true },
    invoiceAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    amountPaid: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'cheque', 'bank_transfer'],
      default: 'bank_transfer',
    },
    paymentNote: { type: String, trim: true },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

goodsReceivedNoteSchema.pre('save', async function (next) {
  if (!this.grnNumber) {
    const count = await mongoose.model('GoodsReceivedNote').countDocuments();
    this.grnNumber = `GRN-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

goodsReceivedNoteSchema.index({ purchaseOrder: 1 });
goodsReceivedNoteSchema.index({ paymentStatus: 1 });

export default mongoose.model('GoodsReceivedNote', goodsReceivedNoteSchema);
