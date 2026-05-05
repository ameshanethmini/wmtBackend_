import { Router } from 'express';
import MaterialCatalog from '../models/MaterialCatalog.js';
import Material from '../models/Material.js';
import StockAdjustment from '../models/StockAdjustment.js';
import MaterialIssuance from '../models/MaterialIssuance.js';
import StockMovement from '../models/StockMovement.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createStockAdjustmentSchema,
  createMaterialIssuanceSchema,
  barcodeLookupSchema,
  stockAdjustmentsQuerySchema,
  stockIssuancesQuerySchema,
  stockHistoryQuerySchema,
} from '../validators/contracts.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'supervisor'));

// ─────────────────────────────────────
// STOCK ADJUSTMENTS
// ─────────────────────────────────────

router.get('/adjustments', validate(stockAdjustmentsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.material) filter.material = req.query.material;
    if (req.query.reason)   filter.reason   = req.query.reason;
    const adjustments = await StockAdjustment.find(filter)
      .populate('material', 'name uom')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(adjustments);
  } catch (err) { next(err); }
});

router.post('/adjustments', validate(createStockAdjustmentSchema), async (req, res, next) => {
  try {
    const { material: materialId, adjustmentType, quantity, reason, note, adjustedBy } = req.body;

    const material = await MaterialCatalog.findById(materialId);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const previousStock = material.currentStock;
    const delta = adjustmentType === 'add' ? Number(quantity) : -Number(quantity);
    const newStock = Math.max(0, previousStock + delta);

    // Apply adjustment
    material.currentStock = newStock;
    await material.save();

    // Create adjustment record
    const adj = await StockAdjustment.create({
      material: materialId, adjustmentType, quantity: Number(quantity),
      reason, note, adjustedBy, previousStock, newStock,
    });

    // Log movement
    await StockMovement.create({
      material: materialId,
      movementType: adjustmentType === 'add' ? 'adjustment_add' : 'adjustment_sub',
      quantity: delta,
      referenceId: adj._id.toString(),
      referenceType: 'StockAdjustment',
      note: `${reason}${note ? ': ' + note : ''}`,
      performedBy: adjustedBy,
      stockBefore: previousStock,
      stockAfter: newStock,
    });

    const populated = await adj.populate('material', 'name uom');
    res.status(201).json(populated);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// MATERIAL ISSUANCES
// ─────────────────────────────────────

router.get('/issuances', validate(stockIssuancesQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.material) filter.material = req.query.material;
    if (req.query.issuedTo) filter.issuedTo = { $regex: req.query.issuedTo, $options: 'i' };
    const issuances = await MaterialIssuance.find(filter)
      .populate('material', 'name uom')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(issuances);
  } catch (err) { next(err); }
});

router.post('/issuances', validate(createMaterialIssuanceSchema), async (req, res, next) => {
  try {
    const { material: materialId, issuedTo, issuedBy, quantity, jobReference, note } = req.body;

    const material = await MaterialCatalog.findById(materialId);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const qty = Number(quantity);
    if (material.currentStock < qty) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${material.currentStock} ${material.uom}` });
    }

    const previousStock = material.currentStock;
    const newStock = previousStock - qty;

    material.currentStock = newStock;
    await material.save();

    const issuance = await MaterialIssuance.create({
      material: materialId, issuedTo, issuedBy, quantity: qty,
      jobReference: jobReference || '', note, previousStock, newStock,
    });

    // Log movement
    await StockMovement.create({
      material: materialId,
      movementType: 'issuance',
      quantity: -qty,
      referenceId: issuance._id.toString(),
      referenceType: 'MaterialIssuance',
      note: `Issued to ${issuedTo}${jobReference ? ' (Job: ' + jobReference + ')' : ''}`,
      performedBy: issuedBy,
      stockBefore: previousStock,
      stockAfter: newStock,
    });

    const populated = await issuance.populate('material', 'name uom');
    res.status(201).json(populated);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// STOCK HISTORY (unified audit trail)
// ─────────────────────────────────────

router.get('/history', validate(stockHistoryQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = {};
    const toDate = (value, endOfDay = false) => {
      if (!value) return null;
      const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      if (endOfDay) date.setHours(23, 59, 59, 999);
      return date;
    };

    if (req.query.material)     filter.material     = req.query.material;
    if (req.query.movementType) filter.movementType = req.query.movementType;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      const fromDate = toDate(req.query.from);
      const endDate = toDate(req.query.to, true);
      if (fromDate) filter.createdAt.$gte = fromDate;
      if (endDate) filter.createdAt.$lte = endDate;
      if (!Object.keys(filter.createdAt).length) delete filter.createdAt;
    }
    const movements = await StockMovement.find(filter)
      .populate('material', 'name uom category')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json(movements);
  } catch (err) { next(err); }
});

router.get('/history/material/:id', async (req, res, next) => {
  try {
    const movements = await StockMovement.find({ material: req.params.id })
      .populate('material', 'name uom')
      .sort({ createdAt: -1 });
    res.json(movements);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// BARCODE LOOKUP
// ─────────────────────────────────────

router.post('/barcode/lookup', validate(barcodeLookupSchema), async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    // Search by name (case-insensitive), barcode field if it exists, or exact ID
    const materials = await MaterialCatalog.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ],
    }).populate('preferredSupplier', 'name').limit(10);

    res.json(materials);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// STOCK OVERVIEW (for dashboard cards)
// ─────────────────────────────────────

router.get('/overview', async (req, res, next) => {
  try {
    const materials = await MaterialCatalog.find().lean();
    const totalItems = materials.length;
    const catalogValue = materials.reduce((s, m) => s + (m.currentStock * (m.unitPrice || 0)), 0);
    const lowStock   = materials.filter(m => m.reorderLevel > 0 && m.currentStock <= m.reorderLevel).length;
    const outOfStock = materials.filter(m => m.currentStock === 0).length;

    const rawMfg = await Material.find().lean();
    const manufacturingRawItems = rawMfg.length;
    const manufacturingRawValue = rawMfg.reduce((s, m) => s + (m.stockQty * (m.unitPrice || 0)), 0);

    const totalValue = catalogValue + manufacturingRawValue;
    const totalItemsAll = totalItems + manufacturingRawItems;

    // Recent movements
    const recentMovements = await StockMovement.find()
      .populate('material', 'name uom')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      totalItems,
      totalItemsAll,
      totalValue,
      catalogValue,
      manufacturingRawItems,
      manufacturingRawValue,
      lowStock,
      outOfStock,
      recentMovements,
    });
  } catch (err) { next(err); }
});

export default router;
