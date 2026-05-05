import { Router } from 'express';
import ExpenseCategory from '../models/ExpenseCategory.js';
import Expense from '../models/Expense.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'accountant'));

const DEFAULT_LIMIT = 20;

function sendMutationError(err, res, next) {
  if (err?.name === 'ValidationError' || err?.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value' });
  }
  return next(err);
}

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

async function resolveExpenseCategoryIds({ category, masterCategory, subCategory }) {
  const requestedCategory = subCategory || category || masterCategory || '';
  if (!requestedCategory) return null;

  const categoryDoc = await ExpenseCategory.findById(requestedCategory).lean();
  if (!categoryDoc) return [requestedCategory];

  if (subCategory || categoryDoc.parentCategory) {
    return [requestedCategory];
  }

  const childIds = await ExpenseCategory.find({ parentCategory: categoryDoc._id })
    .distinct('_id');
  return [categoryDoc._id, ...childIds];
}

// ── Categories ────────────────────────────────────────────
// GET /api/expenses/categories
router.get('/categories', async (req, res, next) => {
  try {
    const filter = {};
    const query = req.query;

    if (query.parentOnly === 'true' || query.kind === 'master') {
      filter.parentCategory = null;
    } else if (query.kind === 'sub') {
      filter.parentCategory = { $ne: null };
    }

    if (query.parentCategory) filter.parentCategory = query.parentCategory;
    if (query.type) filter.type = query.type;
    if (query.status) {
      filter.$or = query.status === 'active'
        ? [{ status: 'active' }, { status: { $exists: false } }]
        : [{ status: query.status }];
    }

    if (query.search) {
      const regex = new RegExp(escapeRegExp(query.search), 'i');
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ name: regex }, { description: regex }, { type: regex }] },
      ];
    }

    const pageRequested = query.page || query.limit;
    const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);

    if (pageRequested) {
      const page = parsePositiveInt(query.page, 1);
      const [total, categories] = await Promise.all([
        ExpenseCategory.countDocuments(filter),
        ExpenseCategory.find(filter)
          .populate('parentCategory', 'name status')
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ]);
      res.json(buildPaginationResponse(categories, total, page, limit));
      return;
    }

    const categories = await ExpenseCategory.find(filter)
      .populate('parentCategory', 'name status')
      .sort({ name: 1 });
    res.json(categories);
  } catch (err) { next(err); }
});

// POST /api/expenses/categories
router.post('/categories', async (req, res, next) => {
  try {
    const category = await ExpenseCategory.create(req.body);
    res.status(201).json(category);
  } catch (err) { sendMutationError(err, res, next); }
});

// PUT /api/expenses/categories/:id
router.put('/categories/:id', async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) { sendMutationError(err, res, next); }
});

// DELETE /api/expenses/categories/:id
router.delete('/categories/:id', async (req, res, next) => {
  try {
    await ExpenseCategory.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Summary / P&L ─────────────────────────────────────────
// GET /api/expenses/summary?year=2025
router.get('/summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(`${year}-01-01`);
    const end   = new Date(`${year + 1}-01-01`);

    const monthly = await Expense.aggregate([
      { $match: { date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { month: { $month: '$date' }, category: '$category' },
          total: { $sum: '$amount' },
        },
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: '_id.category',
          foreignField: '_id',
          as: 'cat',
        },
      },
      // MongoDB expects `preserveNullAndEmptyArrays` (not `preserveNullAndEmpty`)
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          month: '$_id.month',
          categoryName: { $ifNull: ['$cat.name', 'Unknown'] },
          categoryType: { $ifNull: ['$cat.type', 'other'] },
          total: 1,
        },
      },
      { $sort: { month: 1 } },
    ]);

    const totals = await Expense.aggregate([
      { $match: { date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({ monthly, yearTotal: totals[0]?.total || 0 });
  } catch (err) { next(err); }
});

// GET /api/expenses/recurring
router.get('/recurring', async (req, res, next) => {
  try {
    const categories = await ExpenseCategory.find({ isRecurring: true }).sort({ name: 1 });
    res.json(categories);
  } catch (err) { next(err); }
});

// ── Expenses CRUD ─────────────────────────────────────────
// GET /api/expenses
router.get('/', async (req, res, next) => {
  try {
    const query = req.query;
    const filter = {};

    const categoryIds = await resolveExpenseCategoryIds({
      category: query.category,
      masterCategory: query.masterCategory,
      subCategory: query.subCategory,
    });
    if (categoryIds) filter.category = { $in: categoryIds };

    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.isPettyCash) filter.isPettyCash = query.isPettyCash === 'true';
    if (query.status === 'recorded') {
      filter.$or = [
        ...(filter.$or || []),
        { status: 'recorded' },
        { status: { $exists: false } },
      ];
    } else if (query.status) {
      filter.status = query.status;
    }

    if (query.vendor) {
      filter.vendorName = { $regex: escapeRegExp(query.vendor), $options: 'i' };
    }

    if (query.search) {
      const regex = { $regex: escapeRegExp(query.search), $options: 'i' };
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ description: regex }, { vendorName: regex }, { approvedBy: regex }] },
      ];
    }

    if (query.fromDate || query.toDate) {
      filter.date = {};
      const fromDate = parseDateStart(query.fromDate);
      const toDate = parseDateEnd(query.toDate);
      if (fromDate) filter.date.$gte = fromDate;
      if (toDate) filter.date.$lte = toDate;
    } else if (query.month && query.year) {
      const y = parseInt(query.year, 10);
      const m = parseInt(query.month, 10) - 1;
      if (Number.isFinite(y) && Number.isFinite(m)) {
        filter.date = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
      }
    } else if (query.year) {
      const y = parseInt(query.year, 10);
      if (Number.isFinite(y)) {
        filter.date = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
      }
    }

    const pageRequested = query.page || query.limit;
    const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);

    const populateOptions = {
      path: 'category',
      select: 'name type parentCategory status',
      populate: { path: 'parentCategory', select: 'name status' },
    };

    if (pageRequested) {
      const page = parsePositiveInt(query.page, 1);
      const [total, expenses] = await Promise.all([
        Expense.countDocuments(filter),
        Expense.find(filter)
          .populate(populateOptions)
          .sort({ date: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ]);

      res.json(buildPaginationResponse(expenses, total, page, limit));
      return;
    }

    const expenses = await Expense.find(filter)
      .populate(populateOptions)
      .sort({ date: -1 })
      .limit(200);
    res.json(expenses);
  } catch (err) { next(err); }
});

// POST /api/expenses
router.post('/', async (req, res, next) => {
  try {
    const expense = await Expense.create(req.body);
    const populated = await expense.populate('category', 'name type');
    res.status(201).json(populated);
  } catch (err) { sendMutationError(err, res, next); }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('category', 'name type');
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) { sendMutationError(err, res, next); }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
