import { Router } from 'express';
import CustomerOrder, { STATUS_STAGES } from '../models/CustomerOrder.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'supervisor'));

// GET /api/orders/stats
router.get('/stats', async (req, res, next) => {
    try {
        const now = new Date();
        const [total, delivered, delayed, active] = await Promise.all([
            CustomerOrder.countDocuments(),
            CustomerOrder.countDocuments({ status: 'delivered' }),
            CustomerOrder.countDocuments({ isDelayed: true, status: { $ne: 'delivered' } }),
            CustomerOrder.countDocuments({ status: { $nin: ['delivered'] } }),
        ]);

        // On-time rate: delivered orders where deliveredDate <= expectedDeliveryDate
        const onTimeCount = await CustomerOrder.countDocuments({
            status: 'delivered',
            $expr: { $lte: ['$deliveredDate', '$expectedDeliveryDate'] },
        });
        const onTimeRate = delivered > 0 ? Math.round((onTimeCount / delivered) * 100) : 0;

        // Monthly stats for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyRaw = await CustomerOrder.aggregate([
            { $match: { confirmedDate: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$confirmedDate' },
                        month: { $month: '$confirmedDate' },
                    },
                    total: { $sum: 1 },
                    delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                    delayed: { $sum: { $cond: ['$isDelayed', 1, 0] } },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        const monthlyStats = monthlyRaw.map((m) => ({
            label: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
            total: m.total,
            delivered: m.delivered,
            delayed: m.delayed,
        }));

        res.json({ total, delivered, delayed, active, onTimeRate, monthlyStats });
    } catch (err) {
        next(err);
    }
});

// GET /api/orders
router.get('/', async (req, res, next) => {
    try {
        const { status, customerName, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (customerName) filter.customerName = { $regex: customerName, $options: 'i' };

        const orders = await CustomerOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('createdBy', 'name email')
            .lean();

        // Re-check delay status in real-time
        const now = new Date();
        const enriched = orders.map((o) => ({
            ...o,
            isDelayed: o.status !== 'delivered' && o.expectedDeliveryDate < now,
        }));

        const total = await CustomerOrder.countDocuments(filter);
        res.json({ orders: enriched, total });
    } catch (err) {
        next(err);
    }
});

// POST /api/orders
router.post('/', async (req, res, next) => {
    try {
        const { orderNumber, customerName, customerContact, productDescription, quantity, expectedDeliveryDate, linkedJobId, notes } = req.body;

        const order = new CustomerOrder({
            orderNumber,
            customerName,
            customerContact,
            productDescription,
            quantity,
            expectedDeliveryDate,
            linkedJobId: linkedJobId || null,
            notes,
            createdBy: req.user._id,
            statusHistory: [{ status: 'confirmed', note: 'Order confirmed', updatedBy: req.user._id }],
        });
        await order.save();
        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
});

// GET /api/orders/:id
router.get('/:id', async (req, res, next) => {
    try {
        const order = await CustomerOrder.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('linkedJobId', 'jobNumber status')
            .lean();
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const now = new Date();
        order.isDelayed = order.status !== 'delivered' && order.expectedDeliveryDate < now;
        res.json(order);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req, res, next) => {
    try {
        const { status, note } = req.body;
        if (!Object.keys(STATUS_STAGES).includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const order = await CustomerOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        order.status = status;
        if (status === 'delivered') {
            order.deliveredDate = new Date();
        }
        order.statusHistory.push({ status, note: note || '', updatedBy: req.user._id });
        await order.save();
        res.json(order);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/orders/:id/delivery-date
router.patch('/:id/delivery-date', async (req, res, next) => {
    try {
        const { expectedDeliveryDate } = req.body;
        const order = await CustomerOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        order.expectedDeliveryDate = new Date(expectedDeliveryDate);
        order.statusHistory.push({ status: order.status, note: `Delivery date updated to ${expectedDeliveryDate}`, updatedBy: req.user._id });
        await order.save();
        res.json(order);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await CustomerOrder.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
