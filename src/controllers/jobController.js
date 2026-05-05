import * as jobService from '../services/jobService.js';

export async function list(req, res) {
  try {
    const jobs = await jobService.listJobs(req.query);
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getOne(req, res) {
  try {
    const job = await jobService.getJob(req.params.jobId);
    return res.json(job);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const job = await jobService.createJob(req.body, req.user._id);
    return res.status(201).json(job);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function sendToCutting(req, res) {
  try {
    const job = await jobService.sendToCutting(req.params.jobId);
    return res.json(job);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function getAssignLinesMeta(req, res) {
  try {
    const meta = await jobService.getAssignLinesMeta();
    return res.json(meta);
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
