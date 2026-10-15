const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const { department } = req.query;
  let sql = `SELECT s.*, d.name AS department_name,
    (SELECT COUNT(*) FROM exams e WHERE e.subject_id = s.id) AS exam_count
    FROM subjects s JOIN departments d ON d.id = s.department_id`;
  const params = [];
  if (department) { sql += ' WHERE s.department_id = ?'; params.push(Number(department)); }
  sql += ' ORDER BY s.name ASC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const row = db.prepare(`SELECT s.*, d.name AS department_name FROM subjects s JOIN departments d ON d.id=s.department_id WHERE s.id=?`).get(id);
  if (!row) return res.status(404).json({ error: 'المادة غير موجودة' });
  res.json(row);
});

router.post('/', requireAuth, (req, res) => {
  const { name, department_id, year_level } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'اسم المادة مطلوب' });
  if (!department_id) return res.status(400).json({ error: 'القسم مطلوب' });
  const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(Number(department_id));
  if (!dept) return res.status(400).json({ error: 'القسم غير موجود' });
  try {
    const info = db.prepare('INSERT INTO subjects (name, department_id, year_level) VALUES (?, ?, ?)')
      .run(String(name).trim(), Number(department_id), year_level ? String(year_level).trim() : null);
    const row = db.prepare(`SELECT s.*, d.name AS department_name FROM subjects s JOIN departments d ON d.id=s.department_id WHERE s.id=?`).get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: 'فشل إنشاء المادة' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const { name, department_id, year_level } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'اسم المادة مطلوب' });
  const exists = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'المادة غير موجودة' });
  if (department_id) {
    const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(Number(department_id));
    if (!dept) return res.status(400).json({ error: 'القسم غير موجود' });
  }
  db.prepare("UPDATE subjects SET name=?, department_id=?, year_level=?, updated_at=datetime('now') WHERE id=?")
    .run(String(name).trim(), (department_id===undefined||department_id===null||department_id==='') ? exists.department_id : Number(department_id), year_level ? String(year_level).trim() : null, id);
  const row = db.prepare(`SELECT s.*, d.name AS department_name FROM subjects s JOIN departments d ON d.id=s.department_id WHERE s.id=?`).get(id);
  res.json(row);
});

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const exists = db.prepare('SELECT id FROM subjects WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'المادة غير موجودة' });
  db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  res.json({ success: true, message: 'تم حذف المادة' });
});

module.exports = router;