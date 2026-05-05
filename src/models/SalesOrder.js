import mongoose from 'mongoose';

const soItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0 },   // for margin calc
  totalPrice: { type: Number, required: true, min: 0 },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', default: null },
}, { _id: false });

const salesOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    items: [soItemSchema],
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'],
      default: 'pending',
    },
    deliveryDate: { type: Date, default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

salesOrderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('SalesOrder').countDocuments();
    this.orderNumber = `SO-${String(count + 1).padStart(4, '0')}`;
  }
  this.subtotal    = this.items.reduce((s, i) => s + i.totalPrice, 0);
  this.taxAmount   = this.subtotal * (this.taxRate / 100);
  this.totalAmount = this.subtotal + this.taxAmount;
  next();
});

salesOrderSchema.index({ status: 1 });
salesOrderSchema.index({ createdAt: -1 });

export default mongoose.model('SalesOrder', salesOrderSchema);
