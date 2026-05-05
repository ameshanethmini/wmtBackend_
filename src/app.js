import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import path from 'path';
import routes from './routes/index.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = String(origin).trim().toLowerCase();
      if (normalized.endsWith('.vercel.app') || allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      const extra = String(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
      if (extra.includes(normalized)) return callback(null, true);
      console.warn(`[CORS Blocked] ${normalized}`);
      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Cookie parser (inline — no extra package needed)
app.use((req, res, next) => {
  const header = String(req.headers.cookie || '');
  const cookies = {};
  for (const chunk of header.split(';')) {
    const [rawKey, ...rest] = chunk.split('=');
    const key = String(rawKey || '').trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join('=') || '');
  }
  req.cookies = cookies;
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Amesha Manufacturing ERP API is running', timestamp: new Date() });
});
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Amesha Manufacturing ERP API is running', timestamp: new Date() });
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    const label = fields.length ? fields.join(', ') : 'value';
    return res.status(409).json({ error: `Duplicate ${label} already exists.` });
  }

  const status = Number(err.status || err.statusCode || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  res.status(safeStatus).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/amesha_erp')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Amesha ERP Server running on http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('Start MongoDB: docker run -d -p 27017:27017 mongo');
    process.exit(1);
  });
