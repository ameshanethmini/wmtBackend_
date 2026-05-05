import * as overviewService from '../services/overviewService.js';
import * as jobService from '../services/jobService.js';
import * as cuttingService from '../services/cuttingService.js';
import * as washingService from '../services/washingService.js';
import * as qcService from '../services/qcService.js';
import * as finalCheckService from '../services/finalCheckService.js';

// ── Overview ──────────────────────────────────────────────────
export async function getOverview(req, res) {
  try {
    return res.json(await overviewService.getOverview());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Jobs ──────────────────────────────────────────────────────
export async function listJobs(req, res) {
  try {
    return res.json(await jobService.listJobs(req.query));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getJob(req, res) {
  try {
    return res.json(await jobService.getJob(req.params.jobId));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

export async function createJob(req, res) {
  try {
    const issuedFabricQuantity = Number(req.body.issuedFabricQuantity);
    const startupAttachment = req.file
      ? {
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileUrl: `/uploads/jobs/${req.file.filename}`,
        }
      : null;

    const job = await jobService.createJob(
      { ...req.body, issuedFabricQuantity },
      req.user._id,
      startupAttachment
    );
    return res.status(201).json(job);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function updateJobStatus(req, res) {
  try {
    const job = await jobService.updateJobStatus(req.params.jobId, req.body.status);
    return res.json(job);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function assignLines(req, res) {
  try {
    const job = await jobService.assignLines(req.params.jobId, req.body);
    return res.json(job);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function addHourlyProduction(req, res) {
  try {
    const record = await jobService.addHourlyProduction(req.params.jobId, req.body, req.user._id);
    return res.status(201).json(record);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function listLines(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    return res.json(await jobService.listLines({ includeInactive }));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function createLine(req, res) {
  try {
    const line = await jobService.createLine(req.body);
    return res.status(201).json(line);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function updateLine(req, res) {
  try {
    const line = await jobService.updateLine(req.params.id, req.body);
    return res.json(line);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function deleteLine(req, res) {
  try {
    return res.json(await jobService.deleteLine(req.params.id));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// ── Cutting ───────────────────────────────────────────────────
export async function listCutting(req, res) {
  try {
    return res.json(await cuttingService.listCuttingJobs());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function sendToCutting(req, res) {
  try {
    return res.json(await cuttingService.sendToCutting(req.params.jobId));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function saveCutting(req, res) {
  try {
    return res.json(await cuttingService.saveCuttingRecord(req.params.jobId, req.body));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// ── Washing ───────────────────────────────────────────────────
export async function getWashing(req, res) {
  try {
    return res.json(await washingService.getWashingView());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getJobTransfers(req, res) {
  try {
    return res.json(await washingService.getTransfersForJob(req.params.jobId));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function createTransfer(req, res) {
  try {
    const transfer = await washingService.createTransfer(req.body);
    return res.status(201).json(transfer);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function receiveTransfer(req, res) {
  try {
    return res.json(await washingService.receiveTransfer(req.params.id));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function completeWashing(req, res) {
  try {
    return res.json(await washingService.completeWashing(req.params.id));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// ── QC ────────────────────────────────────────────────────────
export async function listQc(req, res) {
  try {
    return res.json(await qcService.listQcJobs());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getQcForJob(req, res) {
  try {
    return res.json(await qcService.getQcForJob(req.params.jobId));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

export async function saveQc(req, res) {
  try {
    const check = await qcService.saveQc(req.params.jobId, req.body, req.user._id);
    return res.status(201).json(check);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function markPackingComplete(req, res) {
  try {
    return res.json(await qcService.markPackingComplete(req.params.jobId));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// ── Final Check ───────────────────────────────────────────────
export async function listFinal(req, res) {
  try {
    return res.json(await finalCheckService.listFinalJobs());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getFinalJobDetail(req, res) {
  try {
    return res.json(await finalCheckService.getFinalJobDetail(req.params.jobId));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

export async function createPackingBatch(req, res) {
  try {
    const batch = await finalCheckService.createPackingBatch(req.params.jobId, req.body, req.user._id);
    return res.status(201).json(batch);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function finalizeJob(req, res) {
  try {
    return res.json(await finalCheckService.finalizeJob(req.params.jobId, req.user._id));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
