import { Router } from 'express';
import User from '../models/Employee.js';
import bcryptjs from 'bcryptjs';

const router = Router();

// TEMPORARY: Admin bootstrap endpoint - DELETE after use
router.post('/bootstrap-admin', async (req, res) => {
  try {
    const email = 'admin@dermas.local';
    const password = 'Admin@2026';
    const pwd = await bcryptjs.hash(password, 10);
    
    const user = await User.findOneAndUpdate(
      { email },
      { 
        email,
        firstName: 'Admin',
        lastName: 'User',
        password: pwd,
        isActive: true,
        employeeId: 'ADM-' + Date.now(),
        department: 'Administration',
        role: 'admin'
      },
      { upsert: true, new: true }
    );
    
    res.json({ 
      success: true,
      email: 'admin@dermas.local',
      password: 'Admin@2026',
      message: 'Admin user created (TEMPORARY ENDPOINT)'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
