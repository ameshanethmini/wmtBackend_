import mongoose from 'mongoose';

const quoteItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const quotationSchema = new mongoose.Schema(
  {
    quoteNumber: { type: String, unique: true },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    items: [quoteItemSchema],
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },   // percentage e.g. 10
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    validUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'rejected', 'converted'],
      default: 'draft',
    },
    notes: { type: String, trim: true },
    convertedToOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', default: null },
  },
  { timestamps: true }
);

quotationSchema.pre('save', async function (next) {
  if (!this.quoteNumber) {
    const count = await mongoose.model('Quotation').countDocuments();
    this.quoteNumber = `QT-${String(count + 1).padStart(4, '0')}`;
  }
  this.subtotal   = this.items.reduce((s, i) => s + i.totalPrice, 0);
  this.taxAmount  = this.subtotal * (this.taxRate / 100);
  this.totalAmount = this.subtotal + this.taxAmount;
  next();
});

export default mongoose.model('Quotation', quotationSchema);
