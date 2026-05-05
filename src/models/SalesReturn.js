import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 1 },
  reason: { type: String, trim: true },
  condition: { type: String, enum: ['sellable', 'damaged'], default: 'sellable' },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCatalog', default: null },
}, { _id: false });

const salesReturnSchema = new mongoose.Schema(
  {
    rmaNumber: { type: String, unique: true },
    salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, trim: true },
    },
    items: [returnItemSchema],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
    refundType: {
      type: String,
      enum: ['credit_note', 'replacement', 'refund'],
      default: 'credit_note',
    },
    approvedBy: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

salesReturnSchema.pre('save', async function (next) {
  if (!this.rmaNumber) {
    const count = await mongoose.model('SalesReturn').countDocuments();
    this.rmaNumber = `RMA-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

salesReturnSchema.index({ status: 1 });

export default mongoose.model('SalesReturn', salesReturnSchema);
