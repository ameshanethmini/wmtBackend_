import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  Employee,
  PasswordResetToken,
  ProductionSection,
  RegistrationRequest,
  User,
} from '../models/index.js';
import { ROLES } from '../config/roles.js';
import {
  notifyPasswordResetRequested,
  notifyRegistrationApproved,
  notifyRegistrationRejected,
  notifyRegistrationSubmitted,
} from './notificationService.js';

const mapEmployeeRoleToUserRole = (employeeRole) => {
  const normalizedRole = String(employeeRole || '').trim();
  if (normalizedRole === ROLES.ADMIN) return ROLES.ADMIN;
  if (normalizedRole === ROLES.MANAGER) return ROLES.MANAGER;
  if (
    normalizedRole === ROLES.SUPERVISOR ||
    normalizedRole === 'line_supervisor' ||
    normalizedRole === 'washing_supervisor' ||
    normalizedRole === 'cutting_supervisor'
  ) {
    return ROLES.SUPERVISOR;
  }
  if (normalizedRole === ROLES.ACCOUNTANT) return ROLES.ACCOUNTANT;
  if (normalizedRole === ROLES.OPERATOR) return ROLES.OPERATOR;
  return ROLES.EMPLOYEE;
};

export async function login(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) throw new Error('Invalid email or password');

  const valid = await user.comparePassword(password);
  if (!valid) throw new Error('Invalid email or password');
  user.lastLoginAt = new Date();
  await user.save();
  const token = jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  const u = user.toObject();
  delete u.password;
  return { user: u, token };
}

export async function getMe(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');
  return user;
}

export async function createRegistrationRequest(payload) {
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  const hasUser = await User.exists({ email: normalizedEmail });
  if (hasUser) throw new Error('An account already exists with this email. Please sign in.');

  const activePending = await RegistrationRequest.findOne({ email: normalizedEmail, status: 'pending' }).lean();
  if (activePending) {
    throw new Error('You already have a pending request. Please wait for administrator review.');
  }

  const passwordHash = await bcrypt.hash(String(payload.password), 10);
  const request = await RegistrationRequest.create({
    fullName: String(payload.fullName || '').trim(),
    email: normalizedEmail,
    phoneNumber: String(payload.phoneNumber || '').trim(),
    passwordHash,
    reasonForAccess: String(payload.reasonForAccess || '').trim(),
    status: 'pending',
  });

  await notifyRegistrationSubmitted(request);

  return {
    _id: request._id,
    status: request.status,
    createdAt: request.createdAt,
    message: 'Your registration request will be reviewed by an administrator before account activation.',
  };
}

export async function getNextEmployeeId() {
  const employees = await Employee.find({ employeeId: { $exists: true, $ne: '' } })
    .select('employeeId')
    .lean();

  let maxNumericId = 0;
  for (const employee of employees) {
    const code = String(employee.employeeId || '').trim();
    const match = /^EMP-(\d+)$/i.exec(code);
    if (!match) continue;
    const numeric = Number.parseInt(match[1], 10);
    if (Number.isFinite(numeric) && numeric > maxNumericId) {
      maxNumericId = numeric;
    }
  }

  return `EMP-${String(maxNumericId + 1).padStart(3, '0')}`;
}

export async function listRegistrationRequests(status = '') {
  const filter = {};
  if (['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
  return RegistrationRequest.find(filter)
    .populate('reviewedBy', 'name email')
    .populate('assignedDepartmentSectionId', 'name slug')
    .sort({ createdAt: -1 })
    .select('-passwordHash')
    .lean();
}

export async function getRegistrationRequestDetail(id) {
  const request = await RegistrationRequest.findById(id)
    .populate('reviewedBy', 'name email')
    .populate('assignedDepartmentSectionId', 'name slug')
    .select('-passwordHash')
    .lean();
  if (!request) throw new Error('Registration request not found');
  return request;
}

export async function approveRegistrationRequest(requestId, reviewerUserId, body) {
  const request = await RegistrationRequest.findById(requestId).select('+passwordHash');
  if (!request) throw new Error('Registration request not found');
  if (request.status !== 'pending') throw new Error('Only pending requests can be approved');

  const existing = await User.findOne({ email: request.email }).lean();
  if (existing) throw new Error('A user with this email already exists');

  if (body.productionSectionId) {
    const section = await ProductionSection.findById(body.productionSectionId).lean();
    if (!section) throw new Error('Invalid department/section assignment');
  }

  const employeeIdCode = String(body.employeeId || '').trim();
  if (employeeIdCode) {
    const duplicateEmployeeId = await Employee.findOne({ employeeId: employeeIdCode }).lean();
    if (duplicateEmployeeId) throw new Error('Employee ID already in use');
  }

  const user = await User.create({
    name: request.fullName,
    email: request.email,
    password: request.passwordHash,
    role: mapEmployeeRoleToUserRole(body.role),
    isActive: true,
  });

  const employee = await Employee.create({
    userId: user._id,
    employeeId: employeeIdCode,
    productionSectionId: body.productionSectionId || null,
    role: body.role,
    name: request.fullName,
    phone: request.phoneNumber,
  });

  request.status = 'approved';
  request.reviewedAt = new Date();
  request.reviewedBy = reviewerUserId;
  request.rejectionReason = '';
  request.approvedUserId = user._id;
  request.approvedEmployeeId = employee._id;
  request.assignedRole = body.role;
  request.assignedDepartmentSectionId = body.productionSectionId || null;
  request.assignedEmployeeIdCode = employeeIdCode;
  await request.save();

  const updated = await RegistrationRequest.findById(request._id)
    .populate('reviewedBy', 'name email')
    .populate('assignedDepartmentSectionId', 'name slug')
    .select('-passwordHash')
    .lean();

  await notifyRegistrationApproved(updated);
  return updated;
}

export async function rejectRegistrationRequest(requestId, reviewerUserId, body) {
  const request = await RegistrationRequest.findById(requestId);
  if (!request) throw new Error('Registration request not found');
  if (request.status !== 'pending') throw new Error('Only pending requests can be rejected');

  request.status = 'rejected';
  request.reviewedAt = new Date();
  request.reviewedBy = reviewerUserId;
  request.rejectionReason = String(body.rejectionReason || '').trim();
  await request.save();

  const updated = await RegistrationRequest.findById(request._id)
    .populate('reviewedBy', 'name email')
    .populate('assignedDepartmentSectionId', 'name slug')
    .select('-passwordHash')
    .lean();

  await notifyRegistrationRejected(updated);
  return updated;
}

export async function lookupRegistrationRequestStatus(email, requestId) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRequestId = String(requestId || '').trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedRequestId)) {
    throw new Error('Invalid request ID');
  }

  const request = await RegistrationRequest.findOne({
    _id: normalizedRequestId,
    email: normalizedEmail,
  })
    .select('fullName email status rejectionReason reviewedAt createdAt')
    .lean();

  if (!request) throw new Error('Request not found for provided email and request ID');

  return {
    requestId: request._id,
    fullName: request.fullName,
    email: request.email,
    status: request.status,
    requestedAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    rejectionReason: request.status === 'rejected' ? request.rejectionReason || '' : '',
  };
}

export async function forgotPassword(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, isActive: true }).lean();

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await PasswordResetToken.deleteMany({ userId: user._id });
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    await notifyPasswordResetRequested({
      email: user.email,
      name: user.name,
      token: rawToken,
    });
  }

  return {
    message: 'If an account with this email exists, a password reset link has been sent.',
  };
}

export async function resetPassword(token, newPassword) {
  const rawToken = String(token || '').trim();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const resetToken = await PasswordResetToken.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!resetToken) throw new Error('Invalid or expired reset token');

  const user = await User.findById(resetToken.userId).select('+password');
  if (!user || !user.isActive) throw new Error('User not found or inactive');

  user.password = String(newPassword);
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();

  await PasswordResetToken.deleteMany({ userId: user._id, _id: { $ne: resetToken._id } });

  return { message: 'Your password has been reset successfully. Please sign in.' };
}

export async function seedAdminUser() {
  const exists = await User.findOne({ email: 'admin@manufacturing.com' });
  if (!exists) {
    await User.create({
      name: 'Admin',
      email: 'admin@manufacturing.com',
      password: 'Admin@1234',
      role: 'admin',
      isActive: true,
    });
    console.log('✅ Default admin created: admin@manufacturing.com / Admin@1234');
  }
}
