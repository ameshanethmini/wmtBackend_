import mongoose from 'mongoose';

const registrationRequestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phoneNumber: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    requestedDepartment: { type: String, trim: true, default: '' },
    reasonForAccess: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    assignedRole: { type: String, trim: true, default: '' },
    assignedDepartmentSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionSection', default: null },
    assignedEmployeeIdCode: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

registrationRequestSchema.index({ email: 1, createdAt: -1 });

export default mongoose.model('RegistrationRequest', registrationRequestSchema);