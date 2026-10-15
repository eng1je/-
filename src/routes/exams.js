const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'exams');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname || '.pdf').toLowerCase())
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || (file.originalname || '').toLowerCase().endsWith('.pdf')) return cb(null, true);
    cb(new Error('الملف يجب أن يكون بصيغة PDF'));
  }
});

function examWithNames(row) {
  if (!row) return null;
  const dept = db.prepare('SELECT name FROM departments WHERE id=?').get(row.department_id);
  const subj = db.prepare('SELECT name FROM subjects WHERE id=?').get(row.subject_id);
  return { ...row, department_name: dept ? dept.name : null, subject_name: subj ? subj.name : null };
}

router.get('/', (req, res) => {
  const { department, subject, year, semester, q } = req.query;
  const where = [];
  const params = [];
  if (department) { where.push('department_id = ?'); params.push(Number(department)); }
  if (subject) { where.push('subject_id = ?'); params.push(Number(subject)); }
  if (year) { where.push('academic_year = ?'); params.push(String(year).trim()); }
  if (semester) { where.push('semester = ?'); params.push(String(semester).trim()); }
  if (q) { where.push('(title LIKE ? OR original_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  let sql = 'SELECT * FROM exams';
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params).map(examWithNames);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'الامتحان غير موجود' });
  res.json(examWithNames(row));
});

// download / view tracking
router.post('/:id/view', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  db.prepare('UPDATE exams SET download_count = download_count + 1 WHERE id = ?').run(id);
  res.json({ success: true });
});

router.get('/:id/file', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'الامتحان غير موجود' });
  const abs = path.resolve(row.file_relpath);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'الملف غير موجود على الخادم' });
  res.type(row.mime_type || 'application/pdf');
  res.sendFile(abs);
});

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  const { title, department_id, subject_id, academic_year, semester } = req.body || {};
  if (!title || !String(title).trim()) return cleanupAndFail(res, req, 'عنوان الامتحان مطلوب');
  if (!department_id) return cleanupAndFail(res, req, 'القسم مطلوب');
  if (!subject_id) return cleanupAndFail(res, req, 'المادة مطلوبة');
  if (!academic_year) return cleanupAndFail(res, req, 'السنة الدراسية مطلوبة');
  if (!semester) return cleanupAndFail(res, req, 'الفصل الدراسي مطلوب');
  if (!req.file) return res.status(400).json({ error: 'ملف PDF مطلوب' });

  const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(Number(department_id));
  const subj = db.prepare('SELECT id FROM subjects WHERE id = ?').get(Number(subject_id));
  if (!dept) return cleanupAndFail(res, req, 'القسم غير موجود');
  if (!subj) return cleanupAndFail(res, req, 'المادة غير موجودة');

  const absPath = req.file.path;
  try {
    const info = db.prepare(`
      INSERT INTO exams (title, department_id, subject_id, academic_year, semester, file_relpath, original_name, mime_type, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(title).trim(),
      Number(department_id),
      Number(subject_id),
      String(academic_year).trim(),
      String(semester).trim(),
      absPath,
      req.file.originalname,
      req.file.mimetype || 'application/pdf',
      req.file.size
    );
    const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(examWithNames(row));
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'فشل رفع الامتحان' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const exists = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'الامتحان غير موجود' });
  const { title, department_id, subject_id, academic_year, semester } = req.body || {};
  if (title && !String(title).trim()) return res.status(400).json({ error: 'عنوان غير صالح' });
  if (department_id) {
    const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(Number(department_id));
    if (!dept) return res.status(400).json({ error: 'القسم غير موجود' });
  }
  if (subject_id) {
    const subj = db.prepare('SELECT id FROM subjects WHERE id = ?').get(Number(subject_id));
    if (!subj) return res.status(400).json({ error: 'المادة غير موجودة' });
  }
  const newDept = department_id ? Number(department_id) : exists.department_id;
  const newSubj = subject_id ? Number(subject_id) : exists.subject_id;
  db.prepare(`UPDATE exams SET
     title=COALESCE(?, title),
     department_id=?,
     subject_id=?,
     academic_year=COALESCE(?, academic_year),
     semester=COALESCE(?, semester),
     updated_at=datetime('now')
     WHERE id=?`)
    .run(title ? String(title).trim() : null, newDept, newSubj,
         academic_year ? String(academic_year).trim() : null,
         semester ? String(semester).trim() : null, id);
  const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  res.json(examWithNames(row));
});

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
  const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'الامتحان غير موجود' });
  const abs = path.resolve(row.file_relpath);
  if (fs.existsSync(abs)) { try { fs.unlinkSync(abs); } catch {} }
  db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  res.json({ success: true, message: 'تم حذف الامتحان' });
});

function cleanupAndFail(res, req, msg) {
  if (req && req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  return res.status(400).json({ error: msg });
}

module.exports = router;

// multer error handling
module.exports.uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'حجم الملف يتجاوز 25MB' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
};
