import * as authService from '../services/authService.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

function getAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

function clearAuthCookie(res) {
  res.clearCookie('auth_token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
}

export async function login(req, res) {
  try {
    const { user, token } = await authService.login(req.body.email, req.body.password);
    res.cookie('auth_token', token, getAuthCookieOptions());
    return res.json({ user, token });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
}

export async function me(req, res) {
  try {
    const user = await authService.getMe(req.user._id);
    return res.json(user);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

export async function createRegistrationRequest(req, res) {
  try {
    const request = await authService.createRegistrationRequest(req.body);
    return res.status(201).json(request);
  } catch (err) {
    return res.status(400).json({ error: 'Unable to submit registration request.' });
  }
}

export async function register(req, res) {
  return createRegistrationRequest(req, res);
}

export async function listRegistrationRequests(req, res) {
  try {
    const rows = await authService.listRegistrationRequests(req.query.status);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Unable to fetch registration requests.' });
  }
}

export async function getRegistrationRequestDetail(req, res) {
  try {
    const request = await authService.getRegistrationRequestDetail(req.params.id);
    return res.json(request);
  } catch (err) {
    return res.status(404).json({ error: 'Registration request not found.' });
  }
}

export async function approveRegistrationRequest(req, res) {
  try {
    const request = await authService.approveRegistrationRequest(req.params.id, req.user._id, req.body);
    return res.json(request);
  } catch (err) {
    return res.status(400).json({ error: 'Unable to approve registration request.' });
  }
}

export async function rejectRegistrationRequest(req, res) {
  try {
    const request = await authService.rejectRegistrationRequest(req.params.id, req.user._id, req.body);
    return res.json(request);
  } catch (err) {
    return res.status(400).json({ error: 'Unable to reject registration request.' });
  }
}

export async function lookupRegistrationRequestStatus(req, res) {
  try {
    const result = await authService.lookupRegistrationRequestStatus(req.query.email, req.query.requestId);
    return res.json(result);
  } catch (err) {
    return res.status(404).json({ error: 'Unable to find request status for provided details.' });
  }
}

export async function forgotPassword(req, res) {
  try {
    const result = await authService.forgotPassword(req.body.email);
    return res.json(result);
  } catch (err) {
    return res.json({ message: 'If an account with this email exists, a password reset link has been sent.' });
  }
}

export async function resetPassword(req, res) {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: 'Unable to reset password with provided token.' });
  }
}

export async function logout(req, res) {
  clearAuthCookie(res);
  return res.json({ message: 'Signed out successfully.' });
}

// TEMPORARY: bootstrap endpoint used only for production E2E verification.
export async function bootstrapAdmin(req, res) {
  try {
    const email = 'admin@dermas.local';
    const password = 'Admin@2026';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.findOneAndUpdate(
      { email },
      {
        email,
        name: 'Production Admin',
        password: passwordHash,
        mustChangePassword: false,
        role: 'admin',
        isActive: true,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).select('+password');

    if (!user) {
      return res.status(500).json({ error: 'Unable to create bootstrap admin user.' });
    }

    return res.json({
      success: true,
      email,
      password,
      message: 'Bootstrap admin ready.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to bootstrap admin user.' });
  }
}
