const http = require('http');

const BASE = 'http://localhost:3000';
let token = null;
function req(method, path, body, headers={}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const h = Object.assign({}, headers);
    let payload = null;
    if (body && !(body instanceof Buffer)) { h['Content-Type']=h['Content-Type']||'application/json'; payload = JSON.stringify(body); }
    else if (body instanceof Buffer) { payload = body; }
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: h }, res => {
      let data=''; res.on('data', d=>data+=d); res.on('end', ()=> {
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        if (res.statusCode >= 400) { const e = new Error((parsed&&parsed.error)||res.statusCode); e.status=res.statusCode; e.data=parsed; reject(e); }
        else resolve(parsed);
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main(){
  console.log('Health:', await req('GET','/api/health'));
  const adminPass = process.env.ADMIN_PASSWORD || (() => { throw new Error('Set ADMIN_PASSWORD env var to run tests'); })();
  const login = await req('POST','/api/auth/login', { username: process.env.ADMIN_USERNAME || 'admin', password: adminPass });
  token = login.token; console.log('Login OK');
  const auth = { Authorization:'Bearer '+token };

  try { await req('POST','/api/departments', {name:'X'}); console.log('FAIL: unauthorized allowed'); process.exitCode=1; return; }
  catch(e){ console.log('Unauthorized blocked:', e.status); }

  const dept = await req('POST','/api/departments', { name:'قسم اختبار', description:'وصف' }, auth);
  console.log('Dept created', dept.id);
  const subj = await req('POST','/api/subjects', { name:'مادة اختبار', department_id: dept.id, year_level:'سنة أولى' }, auth);
  console.log('Subject created', subj.id);

  const boundary = '----boundary'+Math.random();
  const pdfContent = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF';
  const parts = [];
  function addField(name,value){ parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`); }
  addField('title','امتحان اختبار');
  addField('department_id', dept.id);
  addField('subject_id', subj.id);
  addField('academic_year','2024-2025');
  addField('semester','الفصل الأول');
  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const fileFooter = `\r\n--${boundary}--\r\n`;
  const buf = Buffer.concat([
    Buffer.from(parts.join('')+fileHeader),
    Buffer.from(pdfContent),
    Buffer.from(fileFooter)
  ]);
  const upload = await new Promise((resolve,reject)=>{
    const u = new URL(BASE+'/api/exams');
    const r = http.request({hostname:u.hostname,port:u.port,path:u.pathname,method:'POST',
      headers: { 'Authorization': auth.Authorization, 'Content-Type':'multipart/form-data; boundary='+boundary, 'Content-Length': buf.length }}, res=>{
      let data=''; res.on('data',d=>data+=d); res.on('end',()=>{ let p; try{p=JSON.parse(data);}catch{p=data;} if(res.statusCode>=400) reject(new Error(p&&p.error)); else resolve(p); });
    });
    r.on('error',reject); r.write(buf); r.end();
  });
  console.log('Exam uploaded', upload.id);

  const exams = await req('GET', `/api/exams?department=${dept.id}&subject=${subj.id}&year=2024-2025&semester=${encodeURIComponent('الفصل الأول')}`);
  console.log('Filtered exams count:', exams.length);

  const search = await req('GET', '/api/exams?q='+encodeURIComponent('اختبار'));
  console.log('Search count:', search.length);

  const stats = await req('GET','/api/stats', null, auth);
  console.log('Stats exams:', stats.exams);

  await req('PUT','/api/settings', { hero_title:'عنوان اختبار' }, auth);
  const settings = await req('GET','/api/settings');
  console.log('Settings hero_title:', settings.hero_title);

  const upd = await req('PUT','/api/exams/'+upload.id, { title:'امتحان اختبار (معدل)' }, auth);
  console.log('Exam updated:', upd.title);

  const viewRes = await req('POST','/api/exams/'+upload.id+'/view');
  console.log('View tracked:', viewRes);

  await req('DELETE','/api/exams/'+upload.id, null, auth);
  await req('DELETE','/api/subjects/'+subj.id, null, auth);
  await req('DELETE','/api/departments/'+dept.id, null, auth);
  await req('PUT','/api/settings', { hero_title:'أرشيف امتحانات كلية الهندسة' }, auth);
  console.log('Cleanup done');
  console.log('ALL TESTS PASSED');
}

main().catch(e=>{ console.error('TEST FAILED:', e.message, e.data); process.exit(1); });