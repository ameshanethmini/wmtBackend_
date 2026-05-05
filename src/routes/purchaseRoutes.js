import { Router } from 'express';
import Supplier from '../models/Supplier.js';
import MaterialCatalog from '../models/MaterialCatalog.js';
import PurchaseRequisition from '../models/PurchaseRequisition.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import GoodsReceivedNote from '../models/GoodsReceivedNote.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createMaterialCatalogSchema,
  updateMaterialCatalogSchema,
  createPurchaseRequisitionSchema,
  approvePurchaseRequisitionSchema,
  rejectPurchaseRequisitionSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  createGrnSchema,
  recordGrnPaymentSchema,
  purchaseSuppliersQuerySchema,
  purchaseMaterialsQuerySchema,
  purchaseRequisitionsQuerySchema,
  purchaseOrdersQuerySchema,
  purchaseGrnQuerySchema,
  purchaseAnalyticsQuerySchema,
} from '../validators/contracts.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'supervisor'));

const parsePagination = (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

const shouldPaginate = (query) => Boolean(query.page || query.pageSize || query.paginated === 'true');

const sendList = ({ req, res, items, total, page, pageSize }) => {
  if (!shouldPaginate(req.query)) {
    return res.json(items);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return res.json({ items, total, page, pageSize, totalPages });
};

const normalizeString = (value) => String(value || '').trim();

const conflict = (message) => {
  const err = new Error(message);
  err.status = 409;
  return err;
};

const exactTextFilter = (field, value) => ({
  [field]: normalizeString(value),
});

const ensureUniqueSupplier = async (payload, excludeId = null) => {
  const checks = [];
  const excludeFilter = excludeId ? { _id: { $ne: excludeId } } : {};

  if (payload.supplierId) {
    checks.push({
      filter: { supplierId: normalizeString(payload.supplierId).toUpperCase(), ...excludeFilter },
      message: 'Supplier ID already exists',
    });
  }

  if (payload.name) {
    checks.push({
      filter: { ...exactTextFilter('name', payload.name), ...excludeFilter },
      message: 'Supplier name already exists',
      collation: { locale: 'en', strength: 2 },
    });
  }

  if (payload.email) {
    checks.push({
      filter: { ...exactTextFilter('email', payload.email), ...excludeFilter },
      message: 'Supplier email already exists',
      collation: { locale: 'en', strength: 2 },
    });
  }

  for (const check of checks) {
    let query = Supplier.findOne(check.filter).select('_id').lean();
    if (check.collation) query = query.collation(check.collation);
    if (await query) throw conflict(check.message);
  }
};

const ensureUniqueMaterial = async (payload, excludeId = null) => {
  const excludeFilter = excludeId ? { _id: { $ne: excludeId } } : {};

  if (payload.materialCode) {
    const duplicateCode = await MaterialCatalog.findOne({
      materialCode: normalizeString(payload.materialCode).toUpperCase(),
      ...excludeFilter,
    }).select('_id').lean();
    if (duplicateCode) throw conflict('Material code already exists');
  }

  const name = normalizeString(payload.name);
  if (!name) return;

  const category = payload.category || 'other';
  const uom = payload.uom || 'pcs';
  const duplicateMaterial = await MaterialCatalog.findOne({
    name,
    category,
    uom,
    ...excludeFilter,
  })
    .collation({ locale: 'en', strength: 2 })
    .select('_id')
    .lean();

  if (duplicateMaterial) {
    throw conflict('Material already exists with the same name, category, and unit');
  }
};

// ═══════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════

router.get('/suppliers', validate(purchaseSuppliersQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    const { page, pageSize, skip } = parsePagination(req.query);

    if (req.query.active) filter.isActive = req.query.active === 'true';
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;
    if (req.query.contactPerson === 'has') filter.contactPerson = { $exists: true, $nin: ['', null] };
    if (req.query.contactPerson === 'none') {
      filter.$or = [{ contactPerson: { $exists: false } }, { contactPerson: '' }, { contactPerson: null }];
    }
    if (req.query.ratingMin || req.query.ratingMax) {
      filter.rating = {};
      if (req.query.ratingMin) filter.rating.$gte = Number(req.query.ratingMin);
      if (req.query.ratingMax) filter.rating.$lte = Number(req.query.ratingMax);
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        ...(filter.$or || []),
        { supplierId: regex },
        { name: regex },
        { contactPerson: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const [items, total] = await Promise.all([
      Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Supplier.countDocuments(filter),
    ]);
    sendList({ req, res, items, total, page, pageSize });
  } catch (err) { next(err); }
});

router.post('/suppliers', validate(createSupplierSchema), async (req, res, next) => {
  try {
    await ensureUniqueSupplier(req.body);
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (err) { next(err); }
});

router.put('/suppliers/:id', validate(updateSupplierSchema), async (req, res, next) => {
  try {
    await ensureUniqueSupplier(req.body, req.params.id);
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) { next(err); }
});

router.delete('/suppliers/:id', async (req, res, next) => {
  try {
    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// MATERIAL CATALOG
// ═══════════════════════════════════════════════

router.get('/materials', validate(purchaseMaterialsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    const { page, pageSize, skip } = parsePagination(req.query);

    if (req.query.category) filter.category = req.query.category;
    if (req.query.uom) filter.uom = req.query.uom;
    if (req.query.supplierId) filter.preferredSupplier = req.query.supplierId;
    if (req.query.reorderStatus === 'at-risk') {
      filter.$expr = { $and: [{ $gt: ['$reorderLevel', 0] }, { $lte: ['$currentStock', '$reorderLevel'] }] };
    }
    if (req.query.reorderStatus === 'healthy') {
      filter.$expr = { $and: [{ $gt: ['$reorderLevel', 0] }, { $gt: ['$currentStock', '$reorderLevel'] }] };
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ materialCode: regex }, { name: regex }, { description: regex }];
    }

    const [items, total] = await Promise.all([
      MaterialCatalog.find(filter)
        .populate('preferredSupplier', 'name supplierId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      MaterialCatalog.countDocuments(filter),
    ]);

    sendList({ req, res, items, total, page, pageSize });
  } catch (err) { next(err); }
});

router.get('/materials/reorder-alerts', async (req, res, next) => {
  try {
    const items = await MaterialCatalog.find({
      $expr: { $lte: ['$currentStock', '$reorderLevel'] },
      reorderLevel: { $gt: 0 },
    }).populate('preferredSupplier', 'name');
    res.json(items);
  } catch (err) { next(err); }
});

router.post('/materials', validate(createMaterialCatalogSchema), async (req, res, next) => {
  try {
    await ensureUniqueMaterial(req.body);
    const material = await MaterialCatalog.create(req.body);
    res.status(201).json(material);
  } catch (err) { next(err); }
});

router.put('/materials/:id', validate(updateMaterialCatalogSchema), async (req, res, next) => {
  try {
    const existing = await MaterialCatalog.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Material not found' });

    await ensureUniqueMaterial({ ...existing, ...req.body }, req.params.id);
    const material = await MaterialCatalog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json(material);
  } catch (err) { next(err); }
});

router.delete('/materials/:id', async (req, res, next) => {
  try {
    await MaterialCatalog.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// REQUISITIONS
// ═══════════════════════════════════════════════

router.get('/requisitions', validate(purchaseRequisitionsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    const { page, pageSize, skip } = parsePagination(req.query);

    if (req.query.status) filter.status = req.query.status;
    if (req.query.urgency) filter.urgency = req.query.urgency;
    if (req.query.section) filter.section = new RegExp(req.query.section, 'i');
    if (req.query.requestedBy) filter.requestedBy = new RegExp(req.query.requestedBy, 'i');
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ requestedBy: regex }, { section: regex }, { approvalNote: regex }];
    }

    const [items, total] = await Promise.all([
      PurchaseRequisition.find(filter)
        .populate('items.material', 'name uom materialCode')
        .populate('linkedPO', 'poNumber status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      PurchaseRequisition.countDocuments(filter),
    ]);

    sendList({ req, res, items, total, page, pageSize });
  } catch (err) { next(err); }
});

router.post('/requisitions', validate(createPurchaseRequisitionSchema), async (req, res, next) => {
  try {
    const req_ = await PurchaseRequisition.create(req.body);
    res.status(201).json(req_);
  } catch (err) { next(err); }
});

router.put('/requisitions/:id/approve', validate(approvePurchaseRequisitionSchema), async (req, res, next) => {
  try {
    const { approvedBy, approvalNote, supplierId, expectedDeliveryDate } = req.body;
    const requisition = await PurchaseRequisition.findById(req.params.id)
      .populate('items.material', 'name uom unitPrice');
    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });

    // Auto-create Purchase Order
    const poItems = requisition.items.map(item => ({
      material: item.material._id,
      description: item.material.name,
      qty: item.qty,
      unitPrice: item.material.unitPrice || 0,
      totalPrice: item.qty * (item.material.unitPrice || 0),
    }));

    const po = await PurchaseOrder.create({
      supplier: supplierId,
      requisition: requisition._id,
      items: poItems,
      expectedDeliveryDate: expectedDeliveryDate || null,
      notes: `Auto-generated from Requisition`,
    });

    requisition.status = 'approved';
    requisition.approvedBy = approvedBy || 'Manager';
    requisition.approvalNote = approvalNote || '';
    requisition.approvedAt = new Date();
    requisition.linkedPO = po._id;
    await requisition.save();

    res.json({ requisition, po });
  } catch (err) { next(err); }
});

router.put('/requisitions/:id/reject', validate(rejectPurchaseRequisitionSchema), async (req, res, next) => {
  try {
    const requisition = await PurchaseRequisition.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', approvedBy: req.body.approvedBy, approvalNote: req.body.approvalNote, approvedAt: new Date() },
      { new: true }
    );
    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });
    res.json(requisition);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════

router.get('/orders', validate(purchaseOrdersQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    const { page, pageSize, skip } = parsePagination(req.query);

    if (req.query.status) filter.status = req.query.status;
    if (req.query.supplierId) filter.supplier = req.query.supplierId;
    if (req.query.requisitionId) filter.requisition = req.query.requisitionId;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ poNumber: regex }, { notes: regex }];
    }

    if (req.query.paymentStatus) {
      const paymentStatus = req.query.paymentStatus;
      const grns = await GoodsReceivedNote.find().select('purchaseOrder paymentStatus');
      const statusByPo = new Map();
      grns.forEach((g) => {
        const poId = g.purchaseOrder?.toString();
        if (!poId) return;
        if (!statusByPo.has(poId)) statusByPo.set(poId, []);
        statusByPo.get(poId).push(g.paymentStatus);
      });

      const allPoIds = (await PurchaseOrder.find(filter).select('_id')).map((po) => po._id.toString());
      const matchedIds = allPoIds.filter((id) => {
        const statuses = statusByPo.get(id) || [];
        if (paymentStatus === 'unpaid') {
          if (!statuses.length) return true;
          return statuses.every((s) => s === 'unpaid');
        }
        if (paymentStatus === 'paid') {
          return statuses.length > 0 && statuses.every((s) => s === 'paid');
        }
        if (paymentStatus === 'partial') {
          if (!statuses.length) return false;
          const allPaid = statuses.every((s) => s === 'paid');
          const allUnpaid = statuses.every((s) => s === 'unpaid');
          return !allPaid && !allUnpaid;
        }
        return true;
      });

      filter._id = { $in: matchedIds };
    }

    const [items, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplier', 'name email phone supplierId')
        .populate('items.material', 'name uom materialCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      PurchaseOrder.countDocuments(filter),
    ]);

    sendList({ req, res, items, total, page, pageSize });
  } catch (err) { next(err); }
});

router.post('/orders', validate(createPurchaseOrderSchema), async (req, res, next) => {
  try {
    const order = await PurchaseOrder.create(req.body);
    const populated = await order.populate('supplier', 'name email');
    res.status(201).json(populated);
  } catch (err) { next(err); }
});

router.put('/orders/:id', validate(updatePurchaseOrderSchema), async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'PO not found' });
    Object.assign(order, req.body);
    if (req.body.status === 'sent') order.sentAt = new Date();
    await order.save();
    res.json(order);
  } catch (err) { next(err); }
});

router.delete('/orders/:id', async (req, res, next) => {
  try {
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// GOODS RECEIVED NOTES
// ═══════════════════════════════════════════════

router.get('/grn', validate(purchaseGrnQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    const { page, pageSize, skip } = parsePagination(req.query);

    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.qcStatus) filter.overallQcStatus = req.query.qcStatus;
    if (req.query.purchaseOrderId) filter.purchaseOrder = req.query.purchaseOrderId;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.receivedDate = {};
      if (req.query.dateFrom) filter.receivedDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.receivedDate.$lte = new Date(req.query.dateTo);
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ grnNumber: regex }, { receivedBy: regex }, { invoiceNumber: regex }];
    }

    const [items, total] = await Promise.all([
      GoodsReceivedNote.find(filter)
        .populate({ path: 'purchaseOrder', populate: { path: 'supplier', select: 'name supplierId' } })
        .populate('items.material', 'name uom materialCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      GoodsReceivedNote.countDocuments(filter),
    ]);

    sendList({ req, res, items, total, page, pageSize });
  } catch (err) { next(err); }
});

router.post('/grn', validate(createGrnSchema), async (req, res, next) => {
  try {
    const grn = await GoodsReceivedNote.create(req.body);

    // Auto-update material stock for passed QC items
    for (const item of grn.items) {
      if (item.material && item.qcStatus === 'pass') {
        await MaterialCatalog.findByIdAndUpdate(item.material, {
          $inc: { currentStock: item.receivedQty },
        });
      }
    }

    // Mark PO as received
    await PurchaseOrder.findByIdAndUpdate(grn.purchaseOrder, { status: 'received' });

    const populated = await grn.populate([
      { path: 'purchaseOrder', populate: { path: 'supplier', select: 'name' } },
      { path: 'items.material', select: 'name uom' },
    ]);
    res.status(201).json(populated);
  } catch (err) { next(err); }
});

router.put('/grn/:id/payment', validate(recordGrnPaymentSchema), async (req, res, next) => {
  try {
    const { amountPaid, paymentMethod, paymentNote, invoiceNumber, invoiceAmount } = req.body;
    const grn = await GoodsReceivedNote.findById(req.params.id);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });

    if (invoiceNumber) grn.invoiceNumber = invoiceNumber;
    if (invoiceAmount) grn.invoiceAmount = invoiceAmount;
    grn.amountPaid = (grn.amountPaid || 0) + Number(amountPaid);
    grn.paymentMethod = paymentMethod || grn.paymentMethod;
    grn.paymentNote = paymentNote || '';
    grn.paidAt = new Date();

    const outstanding = (grn.invoiceAmount || 0) - grn.amountPaid;
    grn.paymentStatus = outstanding <= 0 ? 'paid' : grn.amountPaid > 0 ? 'partial' : 'unpaid';

    await grn.save();
    res.json(grn);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════

router.get('/analytics/summary', validate(purchaseAnalyticsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(`${year}-01-01`);
    const end   = new Date(`${year + 1}-01-01`);

    // Monthly spend from GRNs
    const monthlySpend = await GoodsReceivedNote.aggregate([
      { $match: { receivedDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: '$receivedDate' }, total: { $sum: '$invoiceAmount' }, paid: { $sum: '$amountPaid' } } },
      { $sort: { _id: 1 } },
    ]);

    // Spend by supplier
    const bySupplier = await GoodsReceivedNote.aggregate([
      { $match: { receivedDate: { $gte: start, $lt: end } } },
      { $lookup: { from: 'purchaseorders', localField: 'purchaseOrder', foreignField: '_id', as: 'po' } },
      { $unwind: '$po' },
      { $lookup: { from: 'suppliers', localField: 'po.supplier', foreignField: '_id', as: 'sup' } },
      // MongoDB expects `preserveNullAndEmptyArrays` (not `preserveNullAndEmpty`)
      { $unwind: { path: '$sup', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$sup._id', supplierName: { $first: '$sup.name' }, total: { $sum: '$invoiceAmount' } } },
      { $sort: { total: -1 } },
    ]);

    // Outstanding payments
    const outstanding = await GoodsReceivedNote.find({ paymentStatus: { $in: ['unpaid', 'partial'] } })
      .populate({ path: 'purchaseOrder', populate: { path: 'supplier', select: 'name' } })
      .select('grnNumber invoiceAmount amountPaid paymentStatus purchaseOrder receivedDate')
      .sort({ receivedDate: 1 });

    const totalOutstanding = outstanding.reduce((s, g) => s + ((g.invoiceAmount || 0) - (g.amountPaid || 0)), 0);

    // PO counts
    const [totalPOs, activePOs, receivedPOs] = await Promise.all([
      PurchaseOrder.countDocuments(),
      PurchaseOrder.countDocuments({ status: { $in: ['draft', 'sent', 'shipped'] } }),
      PurchaseOrder.countDocuments({ status: 'received' }),
    ]);

    res.json({ monthlySpend, bySupplier, outstanding, totalOutstanding, totalPOs, activePOs, receivedPOs });
  } catch (err) { next(err); }
});

export default router;
