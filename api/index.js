const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDB, pool } = require('../server/db');
const { seed } = require('../server/seed');

const app = express();
app.set('trust proxy', 1);

app.use(cors({
  exposedHeaders: ['payment-response', 'x-payment-response']
}));
app.use(express.json());

app.locals.broadcast = () => {};

let dbInitialized = false;

app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDB();
      await seed();
      dbInitialized = true;
    } catch (err) {
      console.error('DB init error:', err.message);
      return res.status(500).json({ error: 'Database initialization failed' });
    }
  }
  next();
});

const apiLimiter = rateLimit({ windowMs: 60000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Rate limited. Wait a moment and try again.' } });
app.use(apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'vercel', db: dbInitialized });
});

app.use('/api/agents', require('../server/routes/agents'));
app.use('/api/tasks', require('../server/routes/tasks'));
app.use('/api/payments', require('../server/routes/payments'));
app.use('/api/reputation', require('../server/routes/reputation'));
app.use('/api/registry', require('../server/routes/registry'));
app.use('/api/xmtp', require('../server/routes/xmtp'));
app.use('/api/dashboard', require('../server/routes/dashboard'));

module.exports = app;
