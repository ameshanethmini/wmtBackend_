import * as supervisorService from '../services/supervisorService.js';

export async function getDashboard(req, res) {
  try {
    const data = await supervisorService.getDashboard(req.user._id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function completeLine(req, res) {
  try {
    const job = await supervisorService.completeLine(req.params.jobId, req.user._id);
    return res.json(job);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
