require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const authRoutes = require('./routes/auth');
const deptRoutes = require('./routes/departments');
const subjectRoutes = require('./routes/subjects');
const examRoutes = require('./routes/exams');
const settingsRoutes = require('./routes/settings');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// seed admin
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD;
const exists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUser);
if (!exists && adminPass) {
  const hash = bcrypt.hashSync(adminPass, 10);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(adminUser, hash);
  console.log(`Seeded admin user "${adminUser}"`);
} else if (!exists) {
  console.warn('No admin user seeded: set ADMIN_PASSWORD in .env before first run');
}

// default settings
const defSettings = {
  site_title: 'أرشيف امتحانات كلية الهندسة – جامعة الجفرة',
  hero_title: 'أرشيف امتحانات كلية الهندسة',
  hero_subtitle: 'جامعة الجفرة – منصة أكاديمية للوصول إلى امتحانات السنوات السابقة',
  footer_contact: 'للتواصل وإضافة أسئلة وامتحانات جديدة إلى الأرشيف'
};
const ins = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
for (const [k,v] of Object.entries(defSettings)) ins.run(k,v);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// static
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// auth middleware for file upload errors
app.use('/api/exams', (req, res, next) => {
  // error handler applied after routes via examRoutes? register here for multer errors on POST
  next();
});

// routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/settings', settingsRoutes);

// upload error handler (multer)
app.use('/api/exams', examRoutes.uploadErrorHandler);

// stats (admin)
app.get('/api/stats', requireAuth, (req, res) => {
  const departments = db.prepare('SELECT COUNT(*) AS c FROM departments').get().c;
  const subjects = db.prepare('SELECT COUNT(*) AS c FROM subjects').get().c;
  const exams = db.prepare('SELECT COUNT(*) AS c FROM exams').get().c;
  const downloads = db.prepare('SELECT COALESCE(SUM(download_count),0) AS c FROM exams').get().c;
  const recent = db.prepare(`
    SELECT e.*, d.name AS department_name, s.name AS subject_name
    FROM exams e JOIN departments d ON d.id=e.department_id JOIN subjects s ON s.id=e.subject_id
    ORDER BY e.created_at DESC LIMIT 5
  `).all();
  // by year
  const byYear = db.prepare('SELECT academic_year AS label, COUNT(*) AS c FROM exams GROUP BY academic_year ORDER BY academic_year').all();
  const byDept = db.prepare(`SELECT d.name AS label, COUNT(e.id) AS c FROM departments d LEFT JOIN exams e ON e.department_id=d.id GROUP BY d.id ORDER BY c DESC`).all();
  res.json({ departments, subjects, exams, downloads, recent, byYear, byDept });
});

// SPA fallback
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// health
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'المسار غير موجود' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});