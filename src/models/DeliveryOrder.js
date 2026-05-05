import mongoose from 'mongoose';

const deliveryOrderSchema = new mongoose.Schema(
  {
    doNumber: { type: String, unique: true },
    salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ['pending', 'packed', 'shipped', 'delivered'],
      default: 'pending',
    },
    driver: { type: String, trim: true, default: '' },
    vehicle: { type: String, trim: true, default: '' },
    dispatchedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

deliveryOrderSchema.pre('save', async function (next) {
  if (!this.doNumber) {
    const count = await mongoose.model('DeliveryOrder').countDocuments();
    this.doNumber = `DO-${String(count + 1).padStart(4, '0')}`;
  }
  if (this.status === 'shipped' && !this.dispatchedAt) this.dispatchedAt = new Date();
  if (this.status === 'delivered' && !this.deliveredAt) this.deliveredAt = new Date();
  next();
});

deliveryOrderSchema.index({ status: 1 });

export default mongoose.model('DeliveryOrder', deliveryOrderSchema);
