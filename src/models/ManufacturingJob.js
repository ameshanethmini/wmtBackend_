import mongoose from 'mongoose';

export const JOB_STATUS = {
  FABRIC_ISSUED: 'FABRIC_ISSUED',
  SENT_TO_CUTTING: 'SENT_TO_CUTTING',
  CUTTING_COMPLETED: 'CUTTING_COMPLETED',
  LINE_ASSIGNED: 'LINE_ASSIGNED',
  LINE_IN_PROGRESS: 'LINE_IN_PROGRESS',
  LINE_COMPLETED: 'LINE_COMPLETED',
  WASHING_OUT: 'WASHING_OUT',
  AFTER_WASH_RECEIVED: 'AFTER_WASH_RECEIVED',
  PACKING_COMPLETED: 'PACKING_COMPLETED',
  WAREHOUSE_RECEIVED: 'WAREHOUSE_RECEIVED',
};

const manufacturingJobSchema = new mongoose.Schema(
  {
    jobNumber: { type: String, required: true, unique: true },
    styleRef: { type: String, trim: true, default: '' },
    batchRef: { type: String, trim: true, default: '' },
    productName: { type: String, trim: true, default: '' },
    productSku: { type: String, trim: true, default: '' },
    fabricType: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    issuedFabricQuantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.FABRIC_ISSUED,
    },
    issueDate: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Cutting data
    fabricUsedQty: { type: Number, default: null },
    fabricWasteQty: { type: Number, default: null },
    totalCutPieces: { type: Number, default: null },
    cuttingRejectQty: { type: Number, default: null },
    cuttingNotes: { type: String, default: '' },

    // Line assignment
    assignedLines: [
      {
        lineName: String,
        assignedQuantity: Number,
        dispatchDate: Date,
      },
    ],

    // Production counts (updated via hourly production)
    producedQty: { type: Number, default: 0 },

    // Optional startup attachment (photo or PDF)
    startupAttachment: {
      fileName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      fileUrl: { type: String, default: '' },
    },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

manufacturingJobSchema.index({ status: 1 });
manufacturingJobSchema.index({ createdAt: -1 });


export default mongoose.model('ManufacturingJob', manufacturingJobSchema);
