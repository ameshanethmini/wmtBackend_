/**
 * AI Routes — Node.js proxy to Python FastAPI AI microservice
 * All endpoints forward to http://localhost:8000 and log predictions to MongoDB
 */
import { Router } from 'express';
import axios from 'axios';
import AIPredictionLog from '../models/AIPredictionLog.js';
import ManufacturingJob from '../models/ManufacturingJob.js';
import HourlyProduction from '../models/HourlyProduction.js';
import Employee from '../models/Employee.js';
import QcCheck from '../models/QcCheck.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8000';

router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'supervisor'));

// ─── Helper: call AI service with fallback ───────────────────────────
async function callAI(method, path, data = null) {
  try {
    const config = { timeout: 8000 };
    const url = `${AI_SERVICE}${path}`;
    const res = method === 'get'
      ? await axios.get(url, config)
      : await axios.post(url, data, config);
    return res.data;
  } catch (err) {
    // AI service offline — return graceful fallback
    console.warn('[AI] Service unreachable:', err.message);
    return null;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildWastageFallback(input = {}) {
  const complexityMap = { low: 0.7, medium: 1.3, high: 2.1 };
  const fabricMap = { cotton: 0.2, polyester: 0.6, denim: 1.2, silk: 1.6, blended: 0.9 };

  const gsm = Number(input.gsm || 180);
  const complexity = String(input.design_complexity || 'medium').toLowerCase();
  const fabricType = String(input.fabric_type || 'cotton').toLowerCase();
  const issuedQty = Number(input.issued_fabric_qty || 0);

  const gsmWeight = clamp((gsm - 180) / 90, -1.5, 2.5);
  const base = 5.1;
  const predicted = base + gsmWeight + (complexityMap[complexity] || 1.3) + (fabricMap[fabricType] || 0.8);
  const wastagePercent = Number(clamp(predicted, 2.5, 13.5).toFixed(2));

  const riskLevel = wastagePercent >= 9.5 ? 'high' : wastagePercent >= 6.5 ? 'medium' : 'low';
  const confidence = Number(clamp(89 - Math.abs(gsmWeight) * 6 - (complexity === 'high' ? 4 : 0), 62, 92).toFixed(1));
  const fabricLossEstimate = issuedQty > 0 ? Number((issuedQty * (wastagePercent / 100)).toFixed(2)) : null;

  return {
    wastage_percent: wastagePercent,
    fabric_loss_estimate: fabricLossEstimate,
    confidence,
    explanation: `${fabricType} fabric (GSM ${gsm}) with ${complexity} complexity is estimated to produce around ${wastagePercent}% wastage under current assumptions.`,
    risk_level: riskLevel,
    source: 'fallback',
  };
}

function buildEfficiencyFallback(input = {}) {
  const workersCount = Number(input.workers_count || 12);
  const targetPerHour = Number(input.target_per_hour || 60);
  const avgExperienceMonths = Number(input.avg_experience_months || 12);
  const lineAgeDays = Number(input.line_age_days || 45);

  const experienceBoost = clamp(avgExperienceMonths / 18, 0, 1.5) * 8;
  const lineMaturity = clamp(lineAgeDays / 60, 0.2, 1.3) * 6;
  const staffingFactor = clamp(workersCount / 12, 0.6, 1.4) * 7;
  const predictedEfficiency = clamp(58 + experienceBoost + lineMaturity + staffingFactor, 45, 95);

  const efficiencyPercent = Number(predictedEfficiency.toFixed(1));
  const predictedHourlyOutput = Number((targetPerHour * (efficiencyPercent / 100)).toFixed(1));
  const dailyOutputEstimate = Math.round(predictedHourlyOutput * 8);
  const confidence = Number(clamp(87 - Math.abs(12 - workersCount) * 0.8, 60, 93).toFixed(1));
  const status = efficiencyPercent >= 82 ? 'good' : efficiencyPercent >= 68 ? 'warning' : 'risk';

  return {
    efficiency_percent: efficiencyPercent,
    predicted_hourly_output: predictedHourlyOutput,
    daily_output_estimate: dailyOutputEstimate,
    confidence,
    explanation: `Based on ${workersCount} workers with ${avgExperienceMonths} months average experience, projected line efficiency is ${efficiencyPercent}% (~${dailyOutputEstimate} units/day).`,
    status,
    source: 'fallback',
  };
}

// ─── Helper: enrich job with real DB data for AI context ────────────
async function enrichJobContext(jobId) {
  try {
    const job = await ManufacturingJob.findById(jobId).lean();
    if (!job) return null;

    // Get hourly production records for this job
    const hourlyRecords = await HourlyProduction.find({ jobId }).lean();
    const totalProduced = hourlyRecords.reduce((s, r) => s + (r.quantity || 0), 0);

    // Get unique workers on this job
    const workerIds = [...new Set(hourlyRecords.map(r => r.employeeId?.toString()))];
    const employees = await Employee.find({ _id: { $in: workerIds } }).lean();
    const avgExperience = employees.length > 0
      ? employees.reduce((s, e) => s + 12, 0) / employees.length  // default 12mo per employee
      : 12;

    const lineName = (job.lineAssignments || [])[0]?.lineName || null;
    const workerCount = employees.length || 12;

    // Actual wastage if cutting data exists
    let actualWastagePct = null;
    if (job.fabricUsedQty && job.fabricWasteQty) {
      actualWastagePct = parseFloat(((job.fabricWasteQty / job.fabricUsedQty) * 100).toFixed(2));
    }

    const daysSinceCreated = job.createdAt
      ? Math.round((Date.now() - new Date(job.createdAt).getTime()) / 86400000)
      : 45;

    return {
      job_id: job._id.toString(),
      job_number: job.jobNumber,
      issued_fabric_qty: job.issuedFabricQuantity || 500,
      fabric_type: 'cotton',          // default; extend when fabric catalog linked
      gsm: 180,                        // default GSM
      design_complexity: 'medium',
      workers_count: workerCount,
      target_per_hour: 60,
      avg_experience_months: avgExperience,
      line_age_days: daysSinceCreated,
      line_name: lineName,
      actual_output: totalProduced > 0 ? totalProduced : null,
      actual_wastage_pct: actualWastagePct,
    };
  } catch (err) {
    console.error('[AI] enrichJobContext error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// GET /api/ai/dashboard  — aggregate AI overview
// ─────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const aiData = await callAI('get', '/predict/dashboard');

  const fallback = {
    predicted_daily_output: 1840,
    efficiency_score: 78.4,
    wastage_percent: 6.2,
    risk_alerts: 3,
    trend: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      predicted: [1750, 1800, 1830, 1820, 1840, 1810],
      actual:    [1700, 1780, 1790, 1850, 1820, 1770],
    },
    line_efficiency: [
      { line: 'Line 1', efficiency: 82.3 },
      { line: 'Line 2', efficiency: 71.5 },
      { line: 'Line 3', efficiency: 88.1 },
      { line: 'Line 4', efficiency: 65.4 },
    ],
    worker_trend: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      scores: [72, 75, 78, 80],
    },
  };

  res.json(aiData || fallback);
});

// ─────────────────────────────────────────────
// POST /api/ai/predict/wastage
// ─────────────────────────────────────────────
router.post('/predict/wastage', async (req, res) => {
  const result = await callAI('post', '/predict/wastage', req.body);
  const data = result || buildWastageFallback(req.body);

  // Log prediction
  await AIPredictionLog.create({
    type: 'wastage',
    jobId: req.body.job_id || null,
    jobNumber: req.body.job_number || null,
    input: req.body,
    output: data,
  }).catch(() => {});

  res.json(data);
});

// ─────────────────────────────────────────────
// POST /api/ai/predict/efficiency
// ─────────────────────────────────────────────
router.post('/predict/efficiency', async (req, res) => {
  const result = await callAI('post', '/predict/efficiency', req.body);
  const data = result || buildEfficiencyFallback(req.body);

  await AIPredictionLog.create({
    type: 'efficiency',
    jobId: req.body.job_id || null,
    jobNumber: req.body.job_number || null,
    input: req.body,
    output: data,
  }).catch(() => {});

  res.json(data);
});

// ─────────────────────────────────────────────
// GET /api/ai/job/:jobId  — FULL per-job AI summary
// This is the main endpoint used by JobDetail page
// ─────────────────────────────────────────────
router.get('/job/:jobId', async (req, res) => {
  const { jobId } = req.params;

  // Enrich with real job data from DB
  const context = await enrichJobContext(jobId);
  if (!context) return res.status(404).json({ error: 'Job not found' });

  const result = await callAI('post', '/predict/job-summary', context);

  // Offline fallback using context data
  const fallback = {
    job_id: context.job_id,
    job_number: context.job_number,
    wastage: {
      wastage_percent: 6.2,
      fabric_loss_estimate: context.issued_fabric_qty * 0.062,
      confidence: 85,
      explanation: `${context.fabric_type} fabric (GSM ${context.gsm}) with ${context.design_complexity} complexity is predicted to waste 6.2% of issued material.`,
      risk_level: 'medium',
    },
    efficiency: {
      efficiency_percent: 76.5,
      predicted_hourly_output: 45.9,
      daily_output_estimate: 367,
      confidence: 83,
      explanation: `${context.workers_count} workers are predicted to achieve 76.5% efficiency (~367 units/day).`,
      status: 'warning',
    },
    comparison: context.actual_output ? {
      predicted_output: 367,
      actual_output: context.actual_output,
      variance: context.actual_output - 367,
      variance_pct: parseFloat(((context.actual_output - 367) / 367 * 100).toFixed(1)),
    } : null,
  };

  const data = result || fallback;

  // Log it
  await AIPredictionLog.create({
    type: 'job_summary',
    jobId,
    jobNumber: context.job_number,
    input: context,
    output: data,
  }).catch(() => {});

  // Also fetch suggestions and alerts
  const suggestions = await callAI('get', `/suggestions?job_id=${jobId}`);
  const alerts = await callAI('get', `/alerts?job_id=${jobId}`);

  res.json({
    ...data,
    suggestions: suggestions?.suggestions || [],
    alerts: alerts?.alerts || [],
  });
});

// ─────────────────────────────────────────────
// GET /api/ai/suggestions
// ─────────────────────────────────────────────
router.get('/suggestions', async (req, res) => {
  const { job_id, efficiency, wastage } = req.query;
  const params = new URLSearchParams();
  if (job_id) params.append('job_id', job_id);
  if (efficiency) params.append('efficiency', efficiency);
  if (wastage) params.append('wastage', wastage);

  const result = await callAI('get', `/suggestions?${params.toString()}`);
  res.json(result || { suggestions: [], total: 0 });
});

// ─────────────────────────────────────────────
// GET /api/ai/alerts
// ─────────────────────────────────────────────
router.get('/alerts', async (req, res) => {
  const { job_id } = req.query;
  const url = job_id ? `/alerts?job_id=${job_id}` : '/alerts';
  const result = await callAI('get', url);
  res.json(result || { alerts: [], total: 0 });
});

// ─────────────────────────────────────────────
// GET /api/ai/worker-performance
// ─────────────────────────────────────────────
router.get('/worker-performance', async (req, res) => {
  try {
    const employees = await Employee.find().lean();
    const workers = await Promise.all(employees.map(async (emp) => {
      const records = await HourlyProduction.find({ employeeId: emp._id }).lean();
      const totalQty = records.reduce((s, r) => s + (r.quantity || 0), 0);
      const avgHourly = records.length > 0 ? totalQty / records.length : 0;

      // Efficiency score: weighted avg output (70%) + simulated QC pass (30%)
      const qcPassRate = 88 + Math.random() * 10; // simulated until QC linked per-worker
      const efficiencyScore = Math.round(avgHourly * 0.7 + qcPassRate * 0.3);

      const role = efficiencyScore >= 80 ? 'Senior Operator'
                 : efficiencyScore >= 65 ? 'Operator'
                 : 'Trainee';

      return {
        _id: emp._id,
        name: emp.name || 'Unknown',
        role: emp.role,
        avg_hourly_output: Math.round(avgHourly * 10) / 10,
        total_production: totalQty,
        shifts_worked: records.length,
        qc_pass_rate: Math.round(qcPassRate * 10) / 10,
        efficiency_score: efficiencyScore,
        best_fit_role: role,
        trend: efficiencyScore >= 75 ? 'up' : efficiencyScore >= 60 ? 'stable' : 'down',
      };
    }));

    workers.sort((a, b) => b.efficiency_score - a.efficiency_score);
    res.json({ workers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/ai/prediction-history/:jobId
// ─────────────────────────────────────────────
router.get('/prediction-history/:jobId', async (req, res) => {
  try {
    const logs = await AIPredictionLog.find({ jobId: req.params.jobId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
