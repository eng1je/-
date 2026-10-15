# أرشيف امتحانات كلية الهندسة – جامعة الجفرة

منصة ويب متكاملة (واجهة طلاب + لوحة إدارة) مع قاعدة بيانات SQLite وتخزين ملفات PDF.

## التشغيل

1. تثبيت التبعيات:
   ```bash
   npm install
   ```
2. (اختياري) إعداد متغيرات البيئة في ملف `.env`:
   ```
   PORT=3000
   JWT_SECRET=change-this-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<your-strong-password>
   DATA_DIR=./data
   UPLOAD_DIR=./uploads
   ```
3. تشغيل الخادم:
   ```bash
   npm start
   ```
4. فتح المتصفح:
   - واجهة الطلاب: http://localhost:3000
   - لوحة الإدارة: http://localhost:3000/admin.html

بيانات الدخول تُعرّف عبر متغيرات `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`). انسخ `.env.example` إلى `.env` ثم عيّن كلمتك السرية قبل التشغيل.

## الاختبارات

```bash
npm test
```
(يتطلب تشغيل الخادم أولاً)

## هيكل المشروع

- `src/` خادم Express و routes و middleware
- `public/` واجهة HTML/CSS/JS
- `data/` قاعدة بيانات SQLite (دائم)
- `uploads/` ملفات PDF (دائم)

## النشر (Render / Docker)

### Render
1. أنشئ Web Service من repo GitHub.
2. Start command: `npm start`
3. Environment:
   - `DATA_DIR=/var/data`
   - `UPLOAD_DIR=/var/data/uploads`
   - `JWT_SECRET=<strong secret>`
   - `ADMIN_PASSWORD=<your secure password>`
4. اربط Persistent Disk بـ `/var/data` (≥1GB).

### Docker
```bash
docker build -t jafra-exam-archive .
docker run -p 3000:3000 -v jafra_data:/data -e JWT_SECRET=... -e ADMIN_PASSWORD=... jafra-exam-archive
```

## رفع إلى GitHub (بدونขнеен الإضافات السرية)
```bash
# لا ترفع .env, data, uploads, node_modules
git init
git add .
git commit -m "Jafra exam archive"
git branch -M main
git remote add origin https://github.com/<user>/jafra-exam-archive.git
git push -u origin main
```
