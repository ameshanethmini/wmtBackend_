import { Router } from 'express';
import authRoutes from './authRoutes.js';
import accountRequestRoutes from './accountRequestRoutes.js';
import accountSettingsRoutes from './accountSettingsRoutes.js';
import manufacturingRoutes from './manufacturingRoutes.js';
import jobRoutes from './jobRoutes.js';
import productionRoutes from './productionRoutes.js';
import supervisorRoutes from './supervisorRoutes.js';
import metaRoutes from './metaRoutes.js';
import orderRoutes from './orderRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import reimbursementRoutes from './reimbursementRoutes.js';
import purchaseRoutes from './purchaseRoutes.js';
import stockRoutes from './stockRoutes.js';
import salesRoutes from './salesRoutes.js';
import aiRoutes from './aiRoutes.js';
import diagnosticsRoutes from './diagnosticsRoutes.js';
import utilRoutes from './utilRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/account-requests', accountRequestRoutes);
router.use('/account-settings', accountSettingsRoutes);

// Manufacturing (amesha core - preserved)
router.use('/manufacturing', manufacturingRoutes);

// Manufacturing extensions (from denimApp)
router.use('/jobs', jobRoutes);
router.use('/production', productionRoutes);
router.use('/supervisor', supervisorRoutes);
router.use('/meta', metaRoutes);

// Business modules (from denimApp)
router.use('/orders', orderRoutes);
router.use('/expenses', expenseRoutes);
router.use('/reimbursements', reimbursementRoutes);
router.use('/purchase', purchaseRoutes);
router.use('/stock', stockRoutes);
router.use('/sales', salesRoutes);
router.use('/ai', aiRoutes);
router.use('/diagnostics', diagnosticsRoutes);
router.use('/util', utilRoutes);

export default router;
