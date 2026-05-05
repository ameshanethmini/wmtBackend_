import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportPath = path.resolve(__dirname, '../../tmp/contract-mismatch-report.json');

router.get('/contracts', async (_req, res) => {
  try {
    const raw = await readFile(reportPath, 'utf8');
    res.type('application/json').send(raw);
  } catch (_err) {
    res.status(404).json({
      error: 'Contract diagnostics report not found',
      hint: 'Run the contract check script to regenerate backend/tmp/contract-mismatch-report.json',
    });
  }
});

export default router;
