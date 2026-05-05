import { Router } from 'express';
import ReimbursementClaim from '../models/ReimbursementClaim.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const DEFAULT_LIMIT = 20;

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateStart(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateEnd(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function buildPaginationResponse(items, total, page, limit) {
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

function normalizeOptionalString(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : undefined;
}

// GET /api/reimbursements?status=pending
router.get('/', requireRole('admin', 'manager', 'accountant'), async (req, res, next) => {
  try {
    const query = req.query;
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.claimType) filter.type = query.claimType;
    if (query.employeeName) {
      filter.employeeName = { $regex: escapeRegExp(query.employeeName), $options: 'i' };
    }
    if (query.search) {
      const regex = { $regex: escapeRegExp(query.search), $options: 'i' };
      filter.$or = [
        { claimId: regex },
        { employeeName: regex },
        { description: regex },
        { paymentMethod: regex },
      ];
    }

    if (query.date) {
      const dateStart = parseDateStart(query.date);
      const dateEnd = parseDateEnd(query.date);
      if (dateStart && dateEnd) {
        filter.expenseDate = { $gte: dateStart, $lte: dateEnd };
      }
    } else if (query.fromDate || query.toDate) {
      filter.expenseDate = {};
      const fromDate = parseDateStart(query.fromDate);
      const toDate = parseDateEnd(query.toDate);
      if (fromDate) filter.expenseDate.$gte = fromDate;
      if (toDate) filter.expenseDate.$lte = toDate;
    }

    if (query.minAmount || query.maxAmount) {
      filter.amount = {};
      const minAmount = Number.parseFloat(query.minAmount);
      const maxAmount = Number.parseFloat(query.maxAmount);
      if (Number.isFinite(minAmount)) filter.amount.$gte = minAmount;
      if (Number.isFinite(maxAmount)) filter.amount.$lte = maxAmount;
    }

    const pageRequested = query.page || query.limit;
    const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);

    if (pageRequested) {
      const page = parsePositiveInt(query.page, 1);
      const [total, claims] = await Promise.all([
        ReimbursementClaim.countDocuments(filter),
        ReimbursementClaim.find(filter)
          .populate('reviewedBy', 'name email')
          .sort({ expenseDate: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ]);

      res.json(buildPaginationResponse(claims, total, page, limit));
      return;
    }

    const claims = await ReimbursementClaim.find(filter)
      .populate('reviewedBy', 'name email')
      .sort({ expenseDate: -1, createdAt: -1 });
    res.json(claims);
  } catch (err) { next(err); }
});

// POST /api/reimbursements  – employee submits claim
router.post('/', requireRole('admin', 'manager', 'accountant', 'employee', 'operator', 'supervisor'), async (req, res, next) => {
  try {
    const claimBody = {
      ...req.body,
      claimId: normalizeOptionalString(req.body.claimId),
      paymentMethod: normalizeOptionalString(req.body.paymentMethod),
      approvedBy: normalizeOptionalString(req.body.approvedBy),
      submittedDate: req.body.submittedDate || new Date(),
      expenseDate: req.body.expenseDate || req.body.submittedDate || new Date(),
    };

    if (!claimBody.claimId) {
      claimBody.claimId = `CLM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    const claim = await ReimbursementClaim.create(claimBody);
    res.status(201).json(claim);
  } catch (err) { next(err); }
});

// PUT /api/reimbursements/:id/approve
router.put('/:id/approve', async (req, res, next) => {
  try {
    const claim = await ReimbursementClaim.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        reviewNote: req.body.reviewNote || '',
        reviewedBy: req.body.reviewedBy || null,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json(claim);
  } catch (err) { next(err); }
});

// PUT /api/reimbursements/:id/reject
router.put('/:id/reject', async (req, res, next) => {
  try {
    const claim = await ReimbursementClaim.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        reviewNote: req.body.reviewNote || '',
        reviewedBy: req.body.reviewedBy || null,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json(claim);
  } catch (err) { next(err); }
});

// DELETE /api/reimbursements/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await ReimbursementClaim.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
