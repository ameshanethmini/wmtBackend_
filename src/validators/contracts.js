import Joi from 'joi';

const objectId = Joi.string().pattern(/^[a-f\d]{24}$/i);
const positiveNumber = Joi.number().min(0);
const nonNegativeInt = Joi.number().integer().min(0);
const positiveInt = Joi.number().integer().min(1);

const paginationQuery = {
  page: positiveInt.optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional(),
  paginated: Joi.string().valid('true', 'false').optional(),
};

const purchaseItemSchema = Joi.object({
  material: objectId.allow(null, '').optional(),
  description: Joi.string().trim().min(1).max(300).required(),
  qty: positiveNumber.required(),
  unitPrice: positiveNumber.required(),
  totalPrice: positiveNumber.required(),
});

const queryString = Joi.string().trim();

export const createSupplierSchema = Joi.object({
  supplierId: Joi.string().trim().max(40).optional(),
  name: Joi.string().trim().min(1).max(160).required(),
  contactPerson: Joi.string().trim().allow('').max(160).optional(),
  email: Joi.string().email().allow('').optional(),
  phone: Joi.string().trim().allow('').max(40).optional(),
  address: Joi.string().trim().allow('').max(500).optional(),
  rating: Joi.number().min(1).max(5).optional(),
  ratingNote: Joi.string().trim().allow('').max(500).optional(),
  isActive: Joi.boolean().optional(),
});

export const updateSupplierSchema = createSupplierSchema.min(1);

export const purchaseSuppliersQuerySchema = Joi.object({
  ...paginationQuery,
  active: Joi.string().valid('true', 'false').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  contactPerson: Joi.string().valid('has', 'none').optional(),
  ratingMin: Joi.number().min(1).max(5).optional(),
  ratingMax: Joi.number().min(1).max(5).optional(),
  search: queryString.max(120).optional(),
});

export const createMaterialCatalogSchema = Joi.object({
  materialCode: Joi.string().trim().max(40).optional(),
  name: Joi.string().trim().min(1).max(180).required(),
  description: Joi.string().trim().allow('').max(500).optional(),
  category: Joi.string().valid('fabric', 'accessory', 'packaging', 'thread', 'chemical', 'other').optional(),
  uom: Joi.string().valid('meters', 'kg', 'pcs', 'rolls', 'liters', 'boxes').optional(),
  reorderLevel: nonNegativeInt.optional(),
  currentStock: nonNegativeInt.optional(),
  unitPrice: positiveNumber.optional(),
  preferredSupplier: objectId.allow(null, '').optional(),
});

export const updateMaterialCatalogSchema = createMaterialCatalogSchema.min(1);

export const purchaseMaterialsQuerySchema = Joi.object({
  ...paginationQuery,
  category: Joi.string().valid('fabric', 'accessory', 'packaging', 'thread', 'chemical', 'other').optional(),
  uom: Joi.string().valid('meters', 'kg', 'pcs', 'rolls', 'liters', 'boxes').optional(),
  supplierId: objectId.optional(),
  reorderStatus: Joi.string().valid('at-risk', 'healthy').optional(),
  search: queryString.max(120).optional(),
});

export const createPurchaseRequisitionSchema = Joi.object({
  requestedBy: Joi.string().trim().min(1).max(160).required(),
  section: Joi.string().trim().min(1).max(160).required(),
  items: Joi.array()
    .items(
      Joi.object({
        material: objectId.required(),
        qty: positiveNumber.required(),
        note: Joi.string().trim().allow('').max(300).optional(),
      })
    )
    .min(1)
    .required(),
  urgency: Joi.string().valid('low', 'medium', 'high').optional(),
  approvalNote: Joi.string().trim().allow('').max(500).optional(),
});

export const approvePurchaseRequisitionSchema = Joi.object({
  approvedBy: Joi.string().trim().allow('').max(160).optional(),
  approvalNote: Joi.string().trim().allow('').max(500).optional(),
  supplierId: objectId.required(),
  expectedDeliveryDate: Joi.date().iso().allow(null, '').optional(),
});

export const rejectPurchaseRequisitionSchema = Joi.object({
  approvedBy: Joi.string().trim().allow('').max(160).optional(),
  approvalNote: Joi.string().trim().allow('').max(500).optional(),
});

export const purchaseRequisitionsQuerySchema = Joi.object({
  ...paginationQuery,
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  urgency: Joi.string().valid('low', 'medium', 'high').optional(),
  section: queryString.max(160).optional(),
  requestedBy: queryString.max(160).optional(),
  search: queryString.max(120).optional(),
});

export const createPurchaseOrderSchema = Joi.object({
  supplier: objectId.required(),
  requisition: objectId.allow(null, '').optional(),
  items: Joi.array().items(purchaseItemSchema).min(1).required(),
  status: Joi.string().valid('draft', 'sent', 'shipped', 'received', 'cancelled').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
  expectedDeliveryDate: Joi.date().iso().allow(null, '').optional(),
});

export const updatePurchaseOrderSchema = Joi.object({
  supplier: objectId.optional(),
  requisition: objectId.allow(null, '').optional(),
  items: Joi.array().items(purchaseItemSchema).min(1).optional(),
  status: Joi.string().valid('draft', 'sent', 'shipped', 'received', 'cancelled').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
  expectedDeliveryDate: Joi.date().iso().allow(null, '').optional(),
}).min(1);

export const purchaseOrdersQuerySchema = Joi.object({
  ...paginationQuery,
  status: Joi.string().valid('draft', 'sent', 'shipped', 'received', 'cancelled').optional(),
  supplierId: objectId.optional(),
  requisitionId: objectId.optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  paymentStatus: Joi.string().valid('unpaid', 'partial', 'paid').optional(),
  search: queryString.max(120).optional(),
});

export const createGrnSchema = Joi.object({
  purchaseOrder: objectId.required(),
  receivedDate: Joi.date().iso().optional(),
  receivedBy: Joi.string().trim().min(1).max(160).required(),
  items: Joi.array()
    .items(
      Joi.object({
        material: objectId.allow(null, '').optional(),
        description: Joi.string().trim().allow('').max(300).optional(),
        orderedQty: positiveNumber.required(),
        receivedQty: positiveNumber.required(),
        qcStatus: Joi.string().valid('pass', 'fail', 'pending').optional(),
        qcNote: Joi.string().trim().allow('').max(500).optional(),
      })
    )
    .min(1)
    .required(),
  overallQcStatus: Joi.string().valid('pass', 'partial', 'fail', 'pending').optional(),
  invoiceNumber: Joi.string().trim().allow('').max(80).optional(),
  invoiceAmount: positiveNumber.optional(),
  paymentStatus: Joi.string().valid('unpaid', 'partial', 'paid').optional(),
  amountPaid: positiveNumber.optional(),
  paymentMethod: Joi.string().valid('cash', 'cheque', 'bank_transfer').optional(),
  paymentNote: Joi.string().trim().allow('').max(500).optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
});

export const recordGrnPaymentSchema = Joi.object({
  amountPaid: positiveNumber.required(),
  paymentMethod: Joi.string().valid('cash', 'cheque', 'bank_transfer').optional(),
  paymentNote: Joi.string().trim().allow('').max(500).optional(),
  invoiceNumber: Joi.string().trim().allow('').max(80).optional(),
  invoiceAmount: positiveNumber.optional(),
});

export const purchaseGrnQuerySchema = Joi.object({
  ...paginationQuery,
  paymentStatus: Joi.string().valid('unpaid', 'partial', 'paid').optional(),
  qcStatus: Joi.string().valid('pass', 'partial', 'fail', 'pending').optional(),
  purchaseOrderId: objectId.optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  search: queryString.max(120).optional(),
});

export const purchaseAnalyticsQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
});

const salesItemSchema = Joi.object({
  description: Joi.string().trim().min(1).max(300).required(),
  qty: positiveNumber.required(),
  unitPrice: positiveNumber.required(),
  totalPrice: positiveNumber.required(),
  costPrice: positiveNumber.optional(),
  material: objectId.allow(null, '').optional(),
});

const customerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(180).required(),
  email: Joi.string().email().allow('').optional(),
  phone: Joi.string().trim().allow('').max(40).optional(),
  address: Joi.string().trim().allow('').max(500).optional(),
});

export const createQuotationSchema = Joi.object({
  customer: customerSchema.required(),
  items: Joi.array().items(salesItemSchema.fork(['costPrice', 'material'], (s) => s.forbidden())).min(1).required(),
  taxRate: Joi.number().min(0).max(100).optional(),
  validUntil: Joi.date().iso().required(),
  status: Joi.string().valid('draft', 'sent', 'approved', 'rejected', 'converted').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
});

export const updateQuotationSchema = Joi.object({
  customer: customerSchema.optional(),
  items: Joi.array().items(salesItemSchema.fork(['costPrice', 'material'], (s) => s.forbidden())).min(1).optional(),
  taxRate: Joi.number().min(0).max(100).optional(),
  validUntil: Joi.date().iso().optional(),
  status: Joi.string().valid('draft', 'sent', 'approved', 'rejected', 'converted').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
}).min(1);

export const convertQuotationSchema = Joi.object({
  deliveryDate: Joi.date().iso().allow(null, '').optional(),
});

export const salesQuotationsQuerySchema = Joi.object({
  status: Joi.string().valid('draft', 'sent', 'approved', 'rejected', 'converted').optional(),
});

export const createSalesOrderSchema = Joi.object({
  quotation: objectId.allow(null, '').optional(),
  customer: customerSchema.required(),
  items: Joi.array().items(salesItemSchema).min(1).required(),
  taxRate: Joi.number().min(0).max(100).optional(),
  status: Joi.string().valid('pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled').optional(),
  deliveryDate: Joi.date().iso().allow(null, '').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
});

export const updateSalesOrderSchema = Joi.object({
  quotation: objectId.allow(null, '').optional(),
  customer: customerSchema.optional(),
  items: Joi.array().items(salesItemSchema).min(1).optional(),
  taxRate: Joi.number().min(0).max(100).optional(),
  status: Joi.string().valid('pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled').optional(),
  deliveryDate: Joi.date().iso().allow(null, '').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
}).min(1);

export const salesOrdersQuerySchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled').optional(),
});

export const createInvoiceSchema = Joi.object({
  salesOrder: objectId.allow(null, '').optional(),
  customer: customerSchema.required(),
  items: Joi.array().items(salesItemSchema).min(1).required(),
  taxRate: Joi.number().min(0).max(100).optional(),
  invoiceType: Joi.string().valid('tax', 'proforma').optional(),
  dueDate: Joi.date().iso().allow(null, '').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
});

export const updateInvoiceSchema = Joi.object({
  salesOrder: objectId.allow(null, '').optional(),
  customer: customerSchema.optional(),
  items: Joi.array().items(salesItemSchema).min(1).optional(),
  taxRate: Joi.number().min(0).max(100).optional(),
  invoiceType: Joi.string().valid('tax', 'proforma').optional(),
  dueDate: Joi.date().iso().allow(null, '').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
}).min(1);

export const recordInvoicePaymentSchema = Joi.object({
  amount: positiveNumber.required(),
  method: Joi.string().valid('cash', 'cheque', 'bank_transfer', 'card').optional(),
  note: Joi.string().trim().allow('').max(500).optional(),
});

export const createCreditNoteSchema = Joi.object({
  reason: Joi.string().trim().allow('').max(500).optional(),
  items: Joi.array().items(salesItemSchema).min(1).optional(),
});

export const salesInvoicesQuerySchema = Joi.object({
  paymentStatus: Joi.string().valid('unpaid', 'partial', 'paid').optional(),
  withCreditNotes: Joi.string().valid('true', 'false').optional(),
});

export const createDeliveryOrderSchema = Joi.object({
  salesOrder: objectId.required(),
  customer: Joi.object({
    name: Joi.string().trim().min(1).max(180).required(),
    phone: Joi.string().trim().allow('').max(40).optional(),
    address: Joi.string().trim().allow('').max(500).optional(),
  }).required(),
  status: Joi.string().valid('pending', 'packed', 'shipped', 'delivered').optional(),
  driver: Joi.string().trim().allow('').max(160).optional(),
  vehicle: Joi.string().trim().allow('').max(120).optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
});

export const updateDeliveryOrderSchema = Joi.object({
  salesOrder: objectId.optional(),
  customer: Joi.object({
    name: Joi.string().trim().min(1).max(180).required(),
    phone: Joi.string().trim().allow('').max(40).optional(),
    address: Joi.string().trim().allow('').max(500).optional(),
  }).optional(),
  status: Joi.string().valid('pending', 'packed', 'shipped', 'delivered').optional(),
  driver: Joi.string().trim().allow('').max(160).optional(),
  vehicle: Joi.string().trim().allow('').max(120).optional(),
  dispatchedAt: Joi.date().iso().allow(null, '').optional(),
  deliveredAt: Joi.date().iso().allow(null, '').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
}).min(1);

export const salesDeliveryQuerySchema = Joi.object({
  status: Joi.string().valid('pending', 'packed', 'shipped', 'delivered').optional(),
});

export const createSalesReturnSchema = Joi.object({
  salesOrder: objectId.required(),
  customer: Joi.object({
    name: Joi.string().trim().min(1).max(180).required(),
    phone: Joi.string().trim().allow('').max(40).optional(),
  }).required(),
  items: Joi.array()
    .items(
      Joi.object({
        description: Joi.string().trim().min(1).max(300).required(),
        qty: positiveNumber.required(),
        reason: Joi.string().trim().allow('').max(500).optional(),
        condition: Joi.string().valid('sellable', 'damaged').optional(),
        material: objectId.allow(null, '').optional(),
      })
    )
    .min(1)
    .required(),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'completed').optional(),
  refundType: Joi.string().valid('credit_note', 'replacement', 'refund').optional(),
  notes: Joi.string().trim().allow('').max(1000).optional(),
});

export const reviewSalesReturnSchema = Joi.object({
  approvedBy: Joi.string().trim().min(1).max(160).required(),
  reviewNote: Joi.string().trim().allow('').max(500).optional(),
  notes: Joi.string().trim().allow('').max(500).optional(),
});

export const salesReturnsQuerySchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'completed').optional(),
});

export const salesAnalyticsQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
});

export const createStockAdjustmentSchema = Joi.object({
  material: objectId.required(),
  adjustmentType: Joi.string().valid('add', 'subtract').required(),
  quantity: positiveNumber.required(),
  reason: Joi.string().trim().min(1).max(160).required(),
  note: Joi.string().trim().allow('').max(500).optional(),
  adjustedBy: Joi.string().trim().min(1).max(160).required(),
});

export const createMaterialIssuanceSchema = Joi.object({
  material: objectId.required(),
  issuedTo: Joi.string().trim().min(1).max(160).required(),
  issuedBy: Joi.string().trim().min(1).max(160).required(),
  quantity: positiveNumber.required(),
  jobReference: Joi.string().trim().allow('').max(120).optional(),
  note: Joi.string().trim().allow('').max(500).optional(),
});

export const barcodeLookupSchema = Joi.object({
  query: Joi.string().trim().min(1).max(120).required(),
});

export const stockAdjustmentsQuerySchema = Joi.object({
  material: objectId.optional(),
  reason: Joi.string().trim().max(160).optional(),
});

export const stockIssuancesQuerySchema = Joi.object({
  material: objectId.optional(),
  issuedTo: Joi.string().trim().max(160).optional(),
});

export const stockHistoryQuerySchema = Joi.object({
  material: objectId.optional(),
  movementType: Joi.string().trim().max(80).optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});
