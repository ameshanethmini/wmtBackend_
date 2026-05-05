import mongoose from 'mongoose';

const STATUS_STAGES = {
  confirmed: 5,
  in_production: 20,
  cutting: 40,
  washing: 55,
  qc: 70,
  packing: 85,
  delivered: 100,
  delayed: null,
};

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const customerOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    customerContact: { type: String, trim: true, default: '' },
    productDescription: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    expectedDeliveryDate: { type: Date, required: true },
    confirmedDate: { type: Date, default: Date.now },
    deliveredDate: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      enum: Object.keys(STATUS_STAGES),
      default: 'confirmed',
    },
    completionPercentage: { type: Number, default: 5, min: 0, max: 100 },
    statusHistory: { type: [statusHistorySchema], default: [] },
    isDelayed: { type: Boolean, default: false },
    linkedJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', default: null },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Auto-compute isDelayed and completionPercentage before save
customerOrderSchema.pre('save', function (next) {
  const now = new Date();
  if (this.status !== 'delivered') {
    this.isDelayed = this.expectedDeliveryDate < now;
    if (this.isDelayed && this.status !== 'delayed') {
      // Don't force status to delayed; just flag it
    }
  } else {
    this.isDelayed = false;
  }
  const pct = STATUS_STAGES[this.status];
  if (pct !== null && pct !== undefined) {
    this.completionPercentage = pct;
  }
  next();
});

customerOrderSchema.index({ status: 1 });
customerOrderSchema.index({ expectedDeliveryDate: 1 });
customerOrderSchema.index({ customerName: 'text' });

export { STATUS_STAGES };
export default mongoose.model('CustomerOrder', customerOrderSchema);
