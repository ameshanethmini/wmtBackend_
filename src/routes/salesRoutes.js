import { Router } from 'express';
import Quotation from '../models/Quotation.js';
import SalesOrder from '../models/SalesOrder.js';
import Invoice from '../models/Invoice.js';
import DeliveryOrder from '../models/DeliveryOrder.js';
import SalesReturn from '../models/SalesReturn.js';
import MaterialCatalog from '../models/MaterialCatalog.js';
import StockMovement from '../models/StockMovement.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createQuotationSchema,
  updateQuotationSchema,
  convertQuotationSchema,
  createSalesOrderSchema,
  updateSalesOrderSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  recordInvoicePaymentSchema,
  createCreditNoteSchema,
  createDeliveryOrderSchema,
  updateDeliveryOrderSchema,
  createSalesReturnSchema,
  reviewSalesReturnSchema,
  salesQuotationsQuerySchema,
  salesOrdersQuerySchema,
  salesInvoicesQuerySchema,
  salesDeliveryQuerySchema,
  salesReturnsQuerySchema,
  salesAnalyticsQuerySchema,
} from '../validators/contracts.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'supervisor'));

// ════════════════════════════════════════════════
// QUOTATIONS
// ════════════════════════════════════════════════

router.get('/quotations', validate(salesQuotationsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const quotes = await Quotation.find(filter).sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) { next(err); }
});

router.post('/quotations', validate(createQuotationSchema), async (req, res, next) => {
  try {
    const q = await Quotation.create(req.body);
    res.status(201).json(q);
  } catch (err) { next(err); }
});

router.put('/quotations/:id', validate(updateQuotationSchema), async (req, res, next) => {
  try {
    const q = await Quotation.findById(req.params.id);
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    Object.assign(q, req.body);
    await q.save();
    res.json(q);
  } catch (err) { next(err); }
});

router.delete('/quotations/:id', async (req, res, next) => {
  try {
    await Quotation.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Convert quotation → Sales Order
router.put('/quotations/:id/convert', validate(convertQuotationSchema), async (req, res, next) => {
  try {
    const quote = await Quotation.findById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quotation not found' });
    if (quote.status === 'converted') return res.status(400).json({ error: 'Already converted' });

    const so = await SalesOrder.create({
      quotation: quote._id,
      customer: quote.customer,
      items: quote.items.map(i => ({ ...i.toObject(), costPrice: 0 })),
      taxRate: quote.taxRate,
      deliveryDate: req.body.deliveryDate || null,
      notes: quote.notes,
    });

    quote.status = 'converted';
    quote.convertedToOrder = so._id;
    await quote.save();

    res.json({ quotation: quote, salesOrder: so });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════
// SALES ORDERS
// ════════════════════════════════════════════════

router.get('/orders', validate(salesOrdersQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await SalesOrder.find(filter)
      .populate('quotation', 'quoteNumber')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
});

router.post('/orders', validate(createSalesOrderSchema), async (req, res, next) => {
  try {
    const so = await SalesOrder.create(req.body);
    res.status(201).json(so);
  } catch (err) { next(err); }
});

router.put('/orders/:id', validate(updateSalesOrderSchema), async (req, res, next) => {
  try {
    const so = await SalesOrder.findById(req.params.id);
    if (!so) return res.status(404).json({ error: 'Sales Order not found' });
    Object.assign(so, req.body);
    await so.save();
    res.json(so);
  } catch (err) { next(err); }
});

router.delete('/orders/:id', async (req, res, next) => {
  try {
    await SalesOrder.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════
// INVOICES
// ════════════════════════════════════════════════

router.get('/invoices', validate(salesInvoicesQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = { isCreditNote: false };
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.withCreditNotes === 'true') delete filter.isCreditNote;
    const invoices = await Invoice.find(filter)
      .populate('salesOrder', 'orderNumber')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) { next(err); }
});

router.post('/invoices', validate(createInvoiceSchema), async (req, res, next) => {
  try {
    const inv = await Invoice.create(req.body);
    res.status(201).json(inv);
  } catch (err) { next(err); }
});

router.put('/invoices/:id', validate(updateInvoiceSchema), async (req, res, next) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    Object.assign(inv, req.body);
    await inv.save();
    res.json(inv);
  } catch (err) { next(err); }
});

// Record payment
router.post('/invoices/:id/payment', validate(recordInvoicePaymentSchema), async (req, res, next) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    inv.payments.push({
      amount: Number(req.body.amount),
      method: req.body.method || 'bank_transfer',
      note: req.body.note || '',
      paidAt: new Date(),
    });
    await inv.save();
    res.json(inv);
  } catch (err) { next(err); }
});

// Issue credit note
router.post('/invoices/:id/credit-note', validate(createCreditNoteSchema), async (req, res, next) => {
  try {
    const original = await Invoice.findById(req.params.id);
    if (!original) return res.status(404).json({ error: 'Invoice not found' });
    const cn = await Invoice.create({
      isCreditNote: true,
      originalInvoice: original._id,
      salesOrder: original.salesOrder,
      customer: original.customer,
      items: req.body.items || original.items,
      taxRate: original.taxRate,
      notes: req.body.reason || 'Credit Note',
    });
    res.status(201).json(cn);
  } catch (err) { next(err); }
});

// Aging report
router.get('/invoices/aging', async (req, res, next) => {
  try {
    const unpaid = await Invoice.find({ paymentStatus: { $in: ['unpaid', 'partial'] }, isCreditNote: false })
      .populate('salesOrder', 'orderNumber')
      .sort({ dueDate: 1 });
    const now = new Date();
    const buckets = { current: [], days30: [], days60: [], over60: [] };
    unpaid.forEach(inv => {
      const daysOverdue = inv.dueDate ? Math.floor((now - new Date(inv.dueDate)) / 86400000) : 0;
      if (daysOverdue <= 0)  buckets.current.push(inv);
      else if (daysOverdue <= 30) buckets.days30.push(inv);
      else if (daysOverdue <= 60) buckets.days60.push(inv);
      else buckets.over60.push(inv);
    });
    res.json(buckets);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════
// DELIVERY ORDERS
// ════════════════════════════════════════════════

router.get('/delivery', validate(salesDeliveryQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const dos = await DeliveryOrder.find(filter)
      .populate('salesOrder', 'orderNumber totalAmount')
      .sort({ createdAt: -1 });
    res.json(dos);
  } catch (err) { next(err); }
});

router.post('/delivery', validate(createDeliveryOrderSchema), async (req, res, next) => {
  try {
    const dOrder = await DeliveryOrder.create(req.body);
    // Update linked SO status to dispatched when DO is created
    if (req.body.salesOrder) {
      await SalesOrder.findByIdAndUpdate(req.body.salesOrder, { status: 'dispatched' });
    }
    res.status(201).json(dOrder);
  } catch (err) { next(err); }
});

router.put('/delivery/:id', validate(updateDeliveryOrderSchema), async (req, res, next) => {
  try {
    const dOrder = await DeliveryOrder.findById(req.params.id);
    if (!dOrder) return res.status(404).json({ error: 'Delivery Order not found' });
    Object.assign(dOrder, req.body);
    await dOrder.save();
    // Sync SO status
    if (req.body.status === 'delivered' && dOrder.salesOrder) {
      await SalesOrder.findByIdAndUpdate(dOrder.salesOrder, { status: 'delivered' });
    }
    res.json(dOrder);
  } catch (err) { next(err); }
});

router.delete('/delivery/:id', async (req, res, next) => {
  try {
    await DeliveryOrder.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════
// SALES RETURNS (RMA)
// ════════════════════════════════════════════════

router.get('/returns', validate(salesReturnsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const returns = await SalesReturn.find(filter)
      .populate('salesOrder', 'orderNumber customer')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (err) { next(err); }
});

router.post('/returns', validate(createSalesReturnSchema), async (req, res, next) => {
  try {
    const rma = await SalesReturn.create(req.body);
    res.status(201).json(rma);
  } catch (err) { next(err); }
});

router.put('/returns/:id/approve', validate(reviewSalesReturnSchema), async (req, res, next) => {
  try {
    const approvedBy = String(req.body.approvedBy || '').trim();
    if (!approvedBy) return res.status(400).json({ error: 'approvedBy is required' });

    const rma = await SalesReturn.findById(req.params.id);
    if (!rma) return res.status(404).json({ error: 'Return not found' });
    if (rma.status !== 'pending') {
      return res.status(409).json({ error: `Only pending returns can be approved. Current status: ${rma.status}` });
    }

    rma.status = 'approved';
    rma.approvedBy = approvedBy;

    // Auto-restock sellable items
    for (const item of rma.items) {
      if (item.condition === 'sellable' && item.material) {
        const mat = await MaterialCatalog.findById(item.material);
        if (mat) {
          const prev = mat.currentStock;
          mat.currentStock += item.qty;
          await mat.save();
          await StockMovement.create({
            material: item.material,
            movementType: 'adjustment_add',
            quantity: item.qty,
            referenceId: rma.rmaNumber,
            referenceType: 'SalesReturn',
            note: `Return re-entry: ${item.reason || 'RMA'}`,
            performedBy: approvedBy,
            stockBefore: prev,
            stockAfter: mat.currentStock,
          });
        }
      }
    }

    rma.status = 'completed';
    await rma.save();
    res.json(rma);
  } catch (err) { next(err); }
});

router.put('/returns/:id/reject', validate(reviewSalesReturnSchema), async (req, res, next) => {
  try {
    const approvedBy = String(req.body.approvedBy || '').trim();
    if (!approvedBy) return res.status(400).json({ error: 'approvedBy is required' });

    const rma = await SalesReturn.findById(req.params.id);
    if (!rma) return res.status(404).json({ error: 'Return not found' });

    if (rma.status !== 'pending') {
      return res.status(409).json({ error: `Only pending returns can be rejected. Current status: ${rma.status}` });
    }

    rma.status = 'rejected';
    rma.approvedBy = approvedBy;
    rma.notes = req.body.reviewNote || req.body.notes || '';
    await rma.save();

    res.json(rma);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════
// SALES ANALYTICS
// ════════════════════════════════════════════════

router.get('/analytics/summary', validate(salesAnalyticsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(`${year}-01-01`);
    const end   = new Date(`${year + 1}-01-01`);

    // Monthly revenue from invoices
    const monthlyRevenue = await Invoice.aggregate([
      { $match: { isCreditNote: false, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: '$createdAt' }, revenue: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' } } },
      { $sort: { _id: 1 } },
    ]);

    // Top selling items
    const topItems = await Invoice.aggregate([
      { $match: { isCreditNote: false, createdAt: { $gte: start, $lt: end } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.description', totalQty: { $sum: '$items.qty' }, totalRevenue: { $sum: '$items.totalPrice' } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);

    // Profit margins from Sales Orders
    const margins = await SalesOrder.aggregate([
      { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: start, $lt: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.description',
          totalRevenue: { $sum: '$items.totalPrice' },
          totalCost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } },
          totalQty: { $sum: '$items.qty' },
        },
      },
      { $addFields: { profit: { $subtract: ['$totalRevenue', '$totalCost'] } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);

    // KPIs
    const [totalRevenue, totalPaid, totalOutstanding, orderCounts] = await Promise.all([
      Invoice.aggregate([{ $match: { isCreditNote: false } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Invoice.aggregate([{ $match: { isCreditNote: false } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
      Invoice.aggregate([{ $match: { isCreditNote: false, paymentStatus: { $in: ['unpaid', 'partial'] } } }, { $group: { _id: null, total: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } } } }]),
      SalesOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    res.json({
      monthlyRevenue,
      topItems,
      margins,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalPaid: totalPaid[0]?.total || 0,
      totalOutstanding: totalOutstanding[0]?.total || 0,
      orderCounts,
    });
  } catch (err) { next(err); }
});

export default router;
