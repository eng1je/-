const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM subjects s WHERE s.department_id = d.id) AS subject_count,
      (SELECT COUNT(*) FROM exams e WHERE e.department_id = d.id) AS exam_count
    FROM departments d ORDER BY d.name ASC
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'القسم غير موجود' });
  res.json(row);
});

router.post('/', requireAuth, (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'اسم القسم مطلوب' });
  try {
    const info = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(String(name).trim(), description ? String(description).trim() : null);
    const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'فشل إنشاء القسم' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const { name, description } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'اسم القسم مطلوب' });
  const exists = db.prepare('SELECT id FROM departments WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'القسم غير موجود' });
  db.prepare("UPDATE departments SET name=?, description=?, updated_at=datetime('now') WHERE id=?")
    .run(String(name).trim(), description ? String(description).trim() : null, id);
  res.json(db.prepare('SELECT * FROM departments WHERE id = ?').get(id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const exists = db.prepare('SELECT id FROM departments WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'القسم غير موجود' });
  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  res.json({ success: true, message: 'تم حذف القسم' });
});

module.exports = router;