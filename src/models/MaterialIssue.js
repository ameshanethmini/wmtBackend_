import mongoose from 'mongoose';

const materialIssueSchema = new mongoose.Schema(
  {
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    quantityIssued: { type: Number, required: true },
    issuedTo: { type: String, trim: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJob', default: null },
    productionSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionSection', default: null },
    recipeStepId: { type: mongoose.Schema.Types.ObjectId, default: null },
    packingBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'PackingBatch', default: null },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

materialIssueSchema.index({ jobId: 1 });
materialIssueSchema.index({ packingBatchId: 1 });

export default mongoose.model('MaterialIssue', materialIssueSchema);
