import bcrypt from 'bcryptjs';
import { Employee, ProductionSection, User } from '../models/index.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

const EMPLOYEE_ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Manager',
  supervisor: 'Supervisor',
  accountant: 'Accountant',
  operator: 'Operator',
  employee: 'Employee',
};

const parseError = (err, fallback) => err?.message || fallback;

const normalizePreferences = (preferences = {}) => ({
  emailNotifications: Boolean(preferences.emailNotifications),
  systemAlerts: Boolean(preferences.systemAlerts),
  darkMode: Boolean(preferences.darkMode),
});

async function getEmployeeAndDepartment(userId) {
  const employee = await Employee.findOne({ userId }).lean();
  let department = '';

  if (employee?.productionSectionId) {
    const section = await ProductionSection.findById(employee.productionSectionId).lean();
    department = section?.name || '';
  }

  return { employee, department };
}

export async function getMyAccountSettings(req, res) {
  try {
    const { employee, department } = await getEmployeeAndDepartment(req.user._id);

    return res.json({
      data: {
        fullName: req.user.name || employee?.name || '',
        email: req.user.email || '',
        phone: req.user.phone || employee?.phone || '',
        address: req.user.address || '',
        dateOfBirth: req.user.dateOfBirth ? new Date(req.user.dateOfBirth).toISOString() : '',
        profilePhoto: req.user.profilePhoto || '',
        employeeId: employee?.employeeId || '',
        role: EMPLOYEE_ROLE_LABELS[employee?.role] || req.user.role || '',
        department,
        designation: EMPLOYEE_ROLE_LABELS[employee?.role] || req.user.role || '',
        joinedDate: req.user.createdAt ? new Date(req.user.createdAt).toISOString() : '',
        employmentStatus: req.user.isActive ? 'Active' : 'Inactive',
        lastLoginAt: req.user.lastLoginAt ? new Date(req.user.lastLoginAt).toISOString() : '',
        preferences: normalizePreferences(req.user.preferences || {}),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: parseError(err, 'Failed to load account settings') });
  }
}

export async function updateProfile(req, res) {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const dateOfBirthRaw = String(req.body.dateOfBirth || '').trim();
    const profilePhoto = String(req.body.profilePhoto || '').trim();
    const uploadedFile = req.file;

    const uploadedProfilePhoto = uploadedFile
      ? `data:${uploadedFile.mimetype};base64,${uploadedFile.buffer.toString('base64')}`
      : profilePhoto;

    let dateOfBirth = null;
    if (dateOfBirthRaw) {
      const parsed = new Date(dateOfBirthRaw);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Please provide a valid date of birth' });
      }
      dateOfBirth = parsed;
    }

    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: 'Full name, email, and phone are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ error: 'Please provide a valid phone number' });
    }

    const duplicateUser = await User.findOne({
      email,
      _id: { $ne: req.user._id },
    }).lean();

    if (duplicateUser) {
      return res.status(409).json({ error: 'Email is already in use by another account' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        name: fullName,
        email,
        phone,
        address,
        dateOfBirth,
        profilePhoto: uploadedProfilePhoto,
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    await Employee.findOneAndUpdate(
      { userId: req.user._id },
      {
        name: fullName,
        phone,
      },
      { new: true }
    );

    return res.json({
      message: 'Profile updated successfully',
      data: {
        fullName: updatedUser?.name || '',
        email: updatedUser?.email || '',
        phone: updatedUser?.phone || '',
        address: updatedUser?.address || '',
        dateOfBirth: updatedUser?.dateOfBirth ? new Date(updatedUser.dateOfBirth).toISOString() : '',
        profilePhoto: updatedUser?.profilePhoto || '',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: parseError(err, 'Failed to update profile') });
  }
}

export async function updatePassword(req, res) {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    const hasAnyPasswordInput = Boolean(currentPassword || newPassword || confirmPassword);
    if (!hasAnyPasswordInput) {
      return res.json({ message: 'No password change requested' });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password must match' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    return res.json({ message: 'Password updated successfully', mustChangePassword: false });
  } catch (err) {
    return res.status(500).json({ error: parseError(err, 'Failed to update password') });
  }
}

export async function updatePreferences(req, res) {
  try {
    const {
      emailNotifications,
      systemAlerts,
      darkMode,
    } = req.body;

    if (
      typeof emailNotifications !== 'boolean' ||
      typeof systemAlerts !== 'boolean' ||
      typeof darkMode !== 'boolean'
    ) {
      return res.status(400).json({
        error: 'emailNotifications, systemAlerts, and darkMode must be boolean values',
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        preferences: {
          emailNotifications,
          systemAlerts,
          darkMode,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    return res.json({
      message: 'Preferences updated successfully',
      data: {
        preferences: normalizePreferences(updatedUser?.preferences || {}),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: parseError(err, 'Failed to update preferences') });
  }
}
