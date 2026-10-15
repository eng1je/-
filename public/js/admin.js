const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
function toast(msg,type='info'){ const c=$('#toastContainer'); const el=document.createElement('div'); el.className='toast '+type; el.textContent=msg; c.appendChild(el); setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300);},4000); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtSize(n){ if(!n) return '-'; if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; }
function parseJwt(t){ try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; } }

let state = { departments:[], subjects:[], exams:[], stats:null, chart:null };

function openModal(title, bodyHtml, onSubmit, onDone){
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `<div class="modal"><div class="modal-header"><h4>${escapeHtml(title)}</h4><button class="modal-close">&times;</button></div><div class="modal-body">${bodyHtml}</div></div>`;
  document.body.appendChild(backdrop);
  const modal = backdrop.querySelector('.modal');
  backdrop.querySelector('.modal-close').addEventListener('click', ()=> backdrop.remove());
  backdrop.addEventListener('click', e=>{ if(e.target===backdrop) backdrop.remove(); });
  const form = modal.querySelector('form');
  if (form && onSubmit) {
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      try { await onSubmit(form); backdrop.remove(); if (onDone) await onDone(); }
      catch(err){ toast(err.message,'error'); }
    });
  }
  return modal;
}
function closeModalAll(){ $$('.modal-backdrop').forEach(b=>b.remove()); }

async function init(){
  if (API.token()) { showAdmin(); await loadAll(); }
  else showLogin();
}
function showLogin(){ $('#loginView').style.display='block'; $('#adminView').style.display='none'; }
function showAdmin(){ $('#loginView').style.display='none'; $('#adminView').style.display='block'; $('#adminUserLabel').textContent = 'مستخدم: ' + (parseJwt(API.token())?.username || 'admin'); }

$('#loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  try {
    const data = await API.post('/api/auth/login', { username: $('#loginUser').value.trim(), password: $('#loginPass').value });
    API.setToken(data.token);
    showAdmin();
    await loadAll();
    toast('تم تسجيل الدخول بنجاح','success');
  } catch(err){ toast(err.message,'error'); }
});
$('#logoutBtn').addEventListener('click', ()=>{ API.setToken(null); showLogin(); });

function switchTab(name){
  $$('.tab').forEach(t=> t.style.display = (t.id==='tab-'+name)?'block':'none');
  $$('#sidebarNav a').forEach(a=> a.classList.toggle('active', a.dataset.tab===name));
  const titles = { dashboard:['لوحة التحكم','إحصائيات وإدارة المحتوى'], departments:['الأقسام','إدارة أقسام الكلية'], subjects:['المواد الدراسية','إدارة المواد'], exams:['الامتحانات','رفع وإدارة ملفات PDF'], settings:['إعدادات الموقع','تخصيص المحتوى'] };
  $('#pageTitle').textContent = titles[name][0];
  $('#pageSub').textContent = titles[name][1];
  if (name==='settings') loadSettingsIntoForm();
}
$$('#sidebarNav a').forEach(a=> a.addEventListener('click', e=>{ e.preventDefault(); switchTab(a.dataset.tab); }));

async function loadAll(){
  await Promise.all([loadDepartments(), loadSubjects(), loadExams()]);
  await loadStats();
  renderAll();
}
async function loadDepartments(){ state.departments = await API.get('/api/departments'); }
async function loadSubjects(){ state.subjects = await API.get('/api/subjects'); }
async function loadExams(){ state.exams = await API.get('/api/exams'); }
async function loadStats(){ state.stats = await API.get('/api/stats'); }

function renderAll(){ renderStatCards(); renderRecent(); renderChart(); renderDeptTable(); renderSubjectFilter(); renderSubjectTable(); renderExamTable(); }

// dashboard
function renderStatCards(){
  const s = state.stats; if(!s) return;
  const cards = [
    {icon:'fa-building',label:'الأقسام',value:s.departments},
    {icon:'fa-book',label:'المواد',value:s.subjects},
    {icon:'fa-file-pdf',label:'الامتحانات',value:s.exams},
    {icon:'fa-download',label:'التحميلات',value:s.downloads},
  ];
  $('#statCards').innerHTML = cards.map(c=>`<div class="stat-card"><h4><i class="fa-solid ${c.icon}" style="margin-left:6px"></i>${c.label}</h4><div class="num">${c.value}</div></div>`).join('');
}
function renderRecent(){
  const s = state.stats; if(!s) return;
  const body = $('#recentTable');
  if(!s.recent.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--gray-600)">لا توجد امتحانات</td></tr>'; return; }
  body.innerHTML = s.recent.map(e=>`<tr><td>${escapeHtml(e.title)}</td><td>${escapeHtml(e.department_name)}</td><td>${escapeHtml(e.subject_name)}</td><td>${escapeHtml(e.academic_year)}</td><td>${escapeHtml(e.semester)}</td><td>${e.download_count||0}</td></tr>`).join('');
}
function renderChart(){
  const s = state.stats; if(!s) return;
  const ctx = $('#chartDepts');
  if(state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, { type:'bar', data:{ labels: s.byDept.map(x=>x.label), datasets:[{label:'عدد الامتحانات',data:s.byDept.map(x=>x.c),backgroundColor:'#c9a227',borderRadius:8}] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} } });
}

// departments
function renderDeptTable(){
  const body = $('#deptTable');
  if(!state.departments.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--gray-600)">لا توجد أقسام</td></tr>'; return; }
  body.innerHTML = state.departments.map((d,i)=>`<tr>
    <td>${i+1}</td><td><b>${escapeHtml(d.name)}</b></td><td>${escapeHtml(d.description||'-')}</td>
    <td>${d.subject_count||0}</td><td>${d.exam_count||0}</td>
    <td class="actions-cell">
      <button class="btn btn-ghost btn-sm" onclick="editDept(${d.id})"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-sm" onclick="deleteDept(${d.id})"><i class="fa-solid fa-trash"></i></button>
    </td></tr>`).join('');
}
$('#addDeptBtn').addEventListener('click', ()=>{
  openModal('إضافة قسم', `
    <form>
      <div class="form-group"><label>اسم القسم</label><input class="input" name="name" required></div>
      <div class="form-group"><label>الوصف</label><textarea class="input" name="description" rows="3"></textarea></div>
      <button class="btn btn-primary" type="submit">إضافة</button>
    </form>`, async (form)=>{
      await API.post('/api/departments', { name: form.name.value.trim(), description: form.description.value.trim() });
    }, async ()=>{ await loadAll(); renderDeptTable(); toast('تم إضافة القسم','success'); });
});
async function editDept(id){
  const d = state.departments.find(x=>x.id===id);
  openModal('تعديل قسم', `
    <form>
      <div class="form-group"><label>اسم القسم</label><input class="input" name="name" value="${escapeHtml(d.name)}" required></div>
      <div class="form-group"><label>الوصف</label><textarea class="input" name="description" rows="3">${escapeHtml(d.description||'')}</textarea></div>
      <button class="btn btn-primary" type="submit">حفظ</button>
    </form>`, async (form)=>{
      await API.put('/api/departments/'+id, { name: form.name.value.trim(), description: form.description.value.trim() });
    }, async ()=>{ await loadAll(); renderDeptTable(); toast('تم تعديل القسم','success'); });
}
async function deleteDept(id){
  if(!confirm('هل أنت متأكد من حذف هذا القسم؟ سيتم حذف مواده وامتحاناته.')) return;
  try { await API.del('/api/departments/'+id); await loadAll(); renderDeptTable(); toast('تم حذف القسم','success'); }
  catch(e){ toast(e.message,'error'); }
}

// subjects
function renderSubjectFilter(){
  const sel = $('#subjectFilterDept');
  sel.innerHTML = '<option value="">كل الأقسام</option>' + state.departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  sel.onchange = ()=> renderSubjectTable();
}
function renderSubjectTable(){
  const filter = $('#subjectFilterDept').value;
  const list = filter ? state.subjects.filter(s=>String(s.department_id)===filter) : state.subjects;
  const body = $('#subjectTable');
  if(!list.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--gray-600)">لا توجد مواد</td></tr>'; return; }
  body.innerHTML = list.map((s,i)=>`<tr>
    <td>${i+1}</td><td><b>${escapeHtml(s.name)}</b></td><td>${escapeHtml(s.department_name)}</td>
    <td>${escapeHtml(s.year_level||'-')}</td><td>${s.exam_count||0}</td>
    <td class="actions-cell">
      <button class="btn btn-ghost btn-sm" onclick="editSubject(${s.id})"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-sm" onclick="deleteSubject(${s.id})"><i class="fa-solid fa-trash"></i></button>
    </td></tr>`).join('');
}
$('#addSubjectBtn').addEventListener('click', ()=>{
  const deptOpts = state.departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  openModal('إضافة مادة', `
    <form>
      <div class="form-group"><label>اسم المادة</label><input class="input" name="name" required></div>
      <div class="form-group"><label>القسم</label><select class="input" name="department_id" required><option value="">اختر</option>${deptOpts}</select></div>
      <div class="form-group"><label>المستوى/السنة</label><input class="input" name="year_level" placeholder="مثال: السنة الثالثة"></div>
      <button class="btn btn-primary" type="submit">إضافة</button>
    </form>`, async (form)=>{
      await API.post('/api/subjects', { name: form.name.value.trim(), department_id: Number(form.department_id.value), year_level: form.year_level.value.trim() });
    }, async ()=>{ await loadAll(); renderSubjectTable(); toast('تم إضافة المادة','success'); });
});
async function editSubject(id){
  const s = state.subjects.find(x=>x.id===id);
  const deptOpts = state.departments.map(d=>`<option value="${d.id}" ${s.department_id===d.id?'selected':''}>${escapeHtml(d.name)}</option>`).join('');
  openModal('تعديل مادة', `
    <form>
      <div class="form-group"><label>اسم المادة</label><input class="input" name="name" value="${escapeHtml(s.name)}" required></div>
      <div class="form-group"><label>القسم</label><select class="input" name="department_id" required>${deptOpts}</select></div>
      <div class="form-group"><label>المستوى/السنة</label><input class="input" name="year_level" value="${escapeHtml(s.year_level||'')}"></div>
      <button class="btn btn-primary" type="submit">حفظ</button>
    </form>`, async (form)=>{
      await API.put('/api/subjects/'+id, { name: form.name.value.trim(), department_id: Number(form.department_id.value), year_level: form.year_level.value.trim() });
    }, async ()=>{ await loadAll(); renderSubjectTable(); toast('تم تعديل المادة','success'); });
}
async function deleteSubject(id){
  if(!confirm('هل أنت متأكد من حذف هذه المادة وامتحاناتها؟')) return;
  try { await API.del('/api/subjects/'+id); await loadAll(); renderSubjectTable(); toast('تم حذف المادة','success'); }
  catch(e){ toast(e.message,'error'); }
}

// exams
function renderExamTable(){
  const body = $('#examTable');
  if(!state.exams.length){ body.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--gray-600)">لا توجد امتحانات</td></tr>'; return; }
  body.innerHTML = state.exams.map((e,i)=>`<tr>
    <td>${i+1}</td>
    <td><b>${escapeHtml(e.title)}</b><br><small style="color:var(--gray-600)">${escapeHtml(e.original_name||'')}</small></td>
    <td>${escapeHtml(e.department_name)}</td><td>${escapeHtml(e.subject_name)}</td>
    <td>${escapeHtml(e.academic_year)}</td><td>${escapeHtml(e.semester)}</td>
    <td>${fmtSize(e.size_bytes)}</td><td>${e.download_count||0}</td>
    <td class="actions-cell">
      <a class="btn btn-ghost btn-sm" href="/api/exams/${e.id}/file" target="_blank"><i class="fa-solid fa-eye"></i></a>
      <button class="btn btn-ghost btn-sm" onclick="editExam(${e.id})"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-sm" onclick="deleteExam(${e.id})"><i class="fa-solid fa-trash"></i></button>
    </td></tr>`).join('');
}
$('#addExamBtn').addEventListener('click', ()=>{
  openUploadModal();
});
function openUploadModal(){
  const deptOpts = state.departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  const subjectOpts = state.subjects.map(s=>`<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.department_name)}</option>`).join('');
  const years = ['2020-2021','2021-2022','2022-2023','2023-2024','2024-2025','2025-2026'];
  const sems = ['الفصل الأول','الفصل الثاني','الفصل الثالث'];
  openModal('رفع امتحان', `
    <form id="examUploadForm" enctype="multipart/form-data">
      <div class="form-group"><label>عنوان الامتحان</label><input class="input" name="title" required></div>
      <div class="form-row">
        <div class="form-group"><label>القسم</label><select class="input" name="department_id" required><option value="">اختر</option>${deptOpts}</select></div>
        <div class="form-group"><label>المادة</label><select class="input" name="subject_id" required><option value="">اختر</option>${subjectOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>السنة الدراسية</label><select class="input" name="academic_year" required>${years.map(y=>`<option value="${y}">${y}</option>`).join('')}</select></div>
        <div class="form-group"><label>الفصل الدراسي</label><select class="input" name="semester" required>${sems.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>ملف PDF</label><input class="input" type="file" name="file" accept="application/pdf" required></div>
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-cloud-arrow-up"></i> رفع</button>
    </form>`, async (form)=>{
      const fd = new FormData(form);
      // FormData already collected from form
      await API.upload('/api/exams', fd);
    }, async ()=>{ await loadAll(); renderExamTable(); toast('تم رفع الامتحان','success'); });
}
async function editExam(id){
  const e = state.exams.find(x=>x.id===id);
  const deptOpts = state.departments.map(d=>`<option value="${d.id}" ${e.department_id===d.id?'selected':''}>${escapeHtml(d.name)}</option>`).join('');
  const subjectOpts = state.subjects.map(s=>`<option value="${s.id}" ${e.subject_id===s.id?'selected':''}>${escapeHtml(s.name)} — ${escapeHtml(s.department_name)}</option>`).join('');
  const years = ['2020-2021','2021-2022','2022-2023','2023-2024','2024-2025','2025-2026'];
  const sems = ['الفصل الأول','الفصل الثاني','الفصل الثالث'];
  openModal('تعديل امتحان', `
    <form>
      <div class="form-group"><label>عنوان الامتحان</label><input class="input" name="title" value="${escapeHtml(e.title)}" required></div>
      <div class="form-row">
        <div class="form-group"><label>القسم</label><select class="input" name="department_id" required>${deptOpts}</select></div>
        <div class="form-group"><label>المادة</label><select class="input" name="subject_id" required>${subjectOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>السنة الدراسية</label><select class="input" name="academic_year" required>${years.map(y=>`<option value="${y}" ${e.academic_year===y?'selected':''}>${y}</option>`).join('')}</select></div>
        <div class="form-group"><label>الفصل الدراسي</label><select class="input" name="semester" required>${sems.map(s=>`<option value="${s}" ${e.semester===s?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      <button class="btn btn-primary" type="submit">حفظ</button>
    </form>`, async (form)=>{
      await API.put('/api/exams/'+id, { title: form.title.value.trim(), department_id: Number(form.department_id.value), subject_id: Number(form.subject_id.value), academic_year: form.academic_year.value, semester: form.semester.value });
    }, async ()=>{ await loadAll(); renderExamTable(); toast('تم تعديل الامتحان','success'); });
}
async function deleteExam(id){
  if(!confirm('هل أنت متأكد من حذف هذا الامتحان؟')) return;
  try { await API.del('/api/exams/'+id); await loadAll(); renderExamTable(); toast('تم حذف الامتحان','success'); }
  catch(e){ toast(e.message,'error'); }
}

// settings
async function loadSettingsIntoForm(){ try {
  const s = await API.get('/api/settings');
  const form = $('#settingsForm');
  form.site_title.value = s.site_title||'';
  form.hero_title.value = s.hero_title||'';
  form.hero_subtitle.value = s.hero_subtitle||'';
  form.footer_contact.value = s.footer_contact||'';
} catch{} }
$('#settingsForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form = e.target;
  try {
    await API.put('/api/settings', {
      site_title: form.site_title.value,
      hero_title: form.hero_title.value,
      hero_subtitle: form.hero_subtitle.value,
      footer_contact: form.footer_contact.value,
    });
    toast('تم حفظ الإعدادات','success');
  } catch(err){ toast(err.message,'error'); }
});
$('#pwdForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form = e.target;
  try {
    await API.post('/api/auth/change-password', { currentPassword: form.currentPassword.value, newPassword: form.newPassword.value });
    toast('تم تغيير كلمة المرور','success');
    form.reset();
  } catch(err){ toast(err.message,'error'); }
});

init();