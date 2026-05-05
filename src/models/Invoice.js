import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'cheque', 'bank_transfer', 'card'], default: 'bank_transfer' },
  note: { type: String, trim: true },
  paidAt: { type: Date, default: Date.now },
}, { _id: false });

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
}, { _id: false });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true },
    salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', default: null },
    customer: {
      name: { type: String, required: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    items: [invoiceItemSchema],
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    invoiceType: { type: String, enum: ['tax', 'proforma'], default: 'tax' },
    dueDate: { type: Date, default: null },
    payments: [paymentSchema],
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    amountPaid: { type: Number, default: 0 },
    // Credit note
    isCreditNote: { type: Boolean, default: false },
    originalInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const prefix = this.isCreditNote ? 'CN' : 'INV';
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  this.subtotal    = this.items.reduce((s, i) => s + i.totalPrice, 0);
  this.taxAmount   = this.subtotal * (this.taxRate / 100);
  this.totalAmount = this.subtotal + this.taxAmount;
  this.amountPaid  = this.payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = this.totalAmount - this.amountPaid;
  this.paymentStatus = outstanding <= 0 ? 'paid' : this.amountPaid > 0 ? 'partial' : 'unpaid';
  next();
});

invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ dueDate: 1 });

export default mongoose.model('Invoice', invoiceSchema);
