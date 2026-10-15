const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve(process.env.DATA_DIR || './data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'exams.db');

// إنشاء الاتصال بقاعدة البيانات باستخدام sqlite3
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// تفعيل المفاتيح الخارجية (Foreign Keys)
db.run('PRAGMA foreign_keys = ON');

// إنشاء الجداول بنفس الهيكل القديم
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      year_level TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      file_relpath TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // إنشاء الفهارس (Indexes) لتحسين الأداء
  db.run(`CREATE INDEX IF NOT EXISTS idx_exams_dept ON exams(department_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(subject_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_exams_year ON exams(academic_year)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_exams_semester ON exams(semester)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_subjects_dept ON subjects(department_id)`);
});

module.exports = db;
