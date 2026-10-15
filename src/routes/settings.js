const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

router.put('/', requireAuth, (req, res) => {
  const entries = req.body || {};
  const stmt = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const tx = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) stmt.run(String(k), String(v));
  });
  try { tx(entries); res.json({ success: true, message: 'تم حفظ الإعدادات' }); }
  catch { res.status(500).json({ error: 'فشل حفظ الإعدادات' }); }
});

module.exports = router;