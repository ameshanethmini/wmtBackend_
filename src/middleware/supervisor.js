import { Employee, ProductionSection } from '../models/index.js';

const LEGACY_SUPERVISOR_ROLES = ['washing_supervisor', 'line_supervisor', 'cutting_supervisor'];

/**
 * Require current user to be washing supervisor (for receive/complete washing).
 */
export async function requireWashingSupervisor(req, res, next) {
  // Main admin can always operate washing actions, even when no Employee row
  // has been created for the admin user.
  if (req.user?.role === 'admin') {
    return next();
  }

  const employee = await Employee.findOne({ userId: req.user._id }).populate('productionSectionId');
  if (!employee) return res.status(403).json({ error: 'Employee record not found' });

  if (employee.role === 'admin') {
    req.employee = employee;
    return next();
  }

  // Allow the final supervisor role and legacy supervisor roles to perform washing actions.
  const isAnySupervisor =
    req.user?.role === 'supervisor' ||
    LEGACY_SUPERVISOR_ROLES.includes(employee.role);

  if (!isAnySupervisor) {
    return res.status(403).json({ error: 'Only admin or supervisor can perform this action' });
  }

  // Keep section check only for legacy washing supervisor assignments.
  if (employee.role === 'washing_supervisor') {
    const section = await ProductionSection.findOne({ slug: 'washing', isActive: true });
    if (!section || !section._id.equals(employee.productionSectionId?._id)) {
      return res.status(403).json({ error: 'Not assigned to washing section' });
    }
  }

  req.employee = employee;
  next();
}

/**
 * Require current user to be supervisor of the given line (by line name or section slug).
 * Used for line complete.
 */
export async function requireSupervisorOfLine(req, res, next) {
  const employee = await Employee.findOne({ userId: req.user._id }).populate('productionSectionId');
  if (!employee) return res.status(403).json({ error: 'Employee record not found' });
  const isLineSupervisor = employee.role === 'supervisor' || employee.role === 'line_supervisor' || employee.role === 'admin';
  if (!isLineSupervisor) {
    return res.status(403).json({ error: 'Only line supervisor can complete line' });
  }
  req.employee = employee;
  next();
}
