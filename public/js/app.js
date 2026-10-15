function toast(msg, type='info'){ const c=document.getElementById('toastContainer'); const el=document.createElement('div'); el.className='toast '+type; el.textContent=msg; c.appendChild(el); setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300);},3500); }
function $(s){return document.querySelector(s)}
function $$(s){return Array.from(document.querySelectorAll(s))}

let state = { departments:[], subjects:[], exams:[], filters:{department:'',subject:'',year:'',semester:'',q:''} };

const YEARS = ['2020-2021','2021-2022','2022-2023','2023-2024','2024-2025','2025-2026'];
const SEMESTERS = ['الفصل الأول','الفصل الثاني','الفصل الثالث'];

async function init(){
  try {
    const [depts, subjects, settings] = await Promise.all([
      API.get('/api/departments'),
      API.get('/api/subjects'),
      API.get('/api/settings')
    ]);
    state.departments = depts;
    state.subjects = subjects;
    if (settings && settings.hero_title) { $('#heroTitle').textContent = settings.hero_title; }
    if (settings && settings.hero_subtitle) { $('#heroSubtitle').textContent = settings.hero_subtitle; }
    renderDepartments();
    populateFilters();
    await loadExams();
    loadStats();
  } catch(e){ toast(e.message,'error'); }
}

async function loadStats(){
  try {
    const exams = await API.get('/api/exams');
    $('#statExams').textContent = exams.length;
    $('#statDepts').textContent = state.departments.length;
    $('#statSubjects').textContent = state.subjects.length;
  } catch{}
}

function renderDepartments(){
  const el = $('#deptGrid');
  if (!state.departments.length){ el.innerHTML = '<div class="empty"><h4>لا توجد أقسام بعد</h4><p>سيتم إضافة الأقسام من لوحة الإدارة.</p></div>'; return; }
  el.innerHTML = state.departments.map(d => `
    <div class="card" onclick="filterByDept(${d.id})">
      <h4>${escapeHtml(d.name)}</h4>
      <p>${escapeHtml(d.description||'قسم أكاديمي ضمن كلية الهندسة')}</p>
      <div class="meta">
        <span class="chip">${d.subject_count||0} مادة</span>
        <span class="chip gold">${d.exam_count||0} امتحان</span>
      </div>
    </div>
  `).join('');
}

function populateFilters(){
  const deptSel = $('#filterDept');
  const subjSel = $('#filterSubject');
  deptSel.innerHTML = '<option value="">كل الأقسام</option>' + state.departments.map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  subjSel.innerHTML = '<option value="">كل المواد</option>' + state.subjects.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  $('#filterYear').innerHTML = '<option value="">كل السنوات</option>' + YEARS.map(y=>`<option value="${y}">${y}</option>`).join('');
  $('#filterSem').innerHTML = '<option value="">كل الفصول</option>' + SEMESTERS.map(s=>`<option value="${s}">${s}</option>`).join('');
}

async function loadExams(){
  const el = $('#examList');
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  const params = new URLSearchParams();
  if (state.filters.department) params.set('department', state.filters.department);
  if (state.filters.subject) params.set('subject', state.filters.subject);
  if (state.filters.year) params.set('year', state.filters.year);
  if (state.filters.semester) params.set('semester', state.filters.semester);
  if (state.filters.q) params.set('q', state.filters.q);
  try {
    const exams = await API.get('/api/exams?' + params.toString());
    state.exams = exams;
    if (!exams.length){ el.innerHTML = '<div class="empty"><h4>لا توجد امتحانات مطابقة</h4><p>جرّب تعديل عوامل التصفية.</p></div>'; return; }
    el.innerHTML = exams.map(e => `
      <div class="exam-item">
        <div class="exam-geom" aria-hidden="true"></div>
        <div class="exam-info">
          <h5>${escapeHtml(e.title)}</h5>
          <div class="meta">
            <span>🏛️ ${escapeHtml(e.department_name||'')}</span>
            <span>📘 ${escapeHtml(e.subject_name||'')}</span>
            <span>📅 ${escapeHtml(e.academic_year)}</span>
            <span>🗓️ ${escapeHtml(e.semester)}</span>
            <span>⬇️ ${e.download_count||0}</span>
          </div>
        </div>
        <div class="exam-actions">
          <button class="btn btn-ghost btn-sm" onclick="previewExam(${e.id})">معاينة</button>
          <a class="btn btn-primary btn-sm" href="/api/exams/${e.id}/file" target="_blank" onclick="trackView(${e.id})">تنزيل</a>
        </div>
      </div>
    `).join('');
  } catch(e){ toast(e.message,'error'); el.innerHTML=''; }
}

function filterByDept(id){ state.filters.department = String(id); $('#filterDept').value = String(id); loadExams(); window.scrollTo({top: document.getElementById('examsSection').offsetTop-80, behavior:'smooth'}); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function previewExam(id){
  const exam = state.exams.find(e=>e.id===id);
  $('#modalTitle').textContent = exam ? exam.title : 'معاينة الامتحان';
  const frame = $('#pdfFrame');
  frame.src = '/api/exams/'+id+'/file';
  $('#modalBackdrop').classList.add('open');
  try { await API.post('/api/exams/'+id+'/view'); } catch{}
}
function closeModal(){ $('#modalBackdrop').classList.remove('open'); setTimeout(()=>{$('#pdfFrame').src='about:blank';},300); }
async function trackView(id){ try { await API.post('/api/exams/'+id+'/view'); } catch{} }

document.addEventListener('DOMContentLoaded', () => {
  init();
  const debouncedLoad = debounce(loadExams,400);
  $$('#searchBar .input, #searchBar select').forEach(el=>{
    if (el.id==='searchInput') el.addEventListener('input', e=>{ state.filters.q=e.target.value; debouncedLoad(); });
  });
  $('#filterDept').addEventListener('change', e=>{ state.filters.department=e.target.value; loadExams(); });
  $('#filterSubject').addEventListener('change', e=>{ state.filters.subject=e.target.value; loadExams(); });
  $('#filterYear').addEventListener('change', e=>{ state.filters.year=e.target.value; loadExams(); });
  $('#filterSem').addEventListener('change', e=>{ state.filters.semester=e.target.value; loadExams(); });
  $('#clearFilters').addEventListener('click', ()=>{ state.filters={department:'',subject:'',year:'',semester:'',q:''}; $('#searchInput').value=''; populateFilters?0:0; $('#filterDept').value=''; $('#filterSubject').value=''; $('#filterYear').value=''; $('#filterSem').value=''; loadExams(); });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', e=>{ if(e.target.id==='modalBackdrop') closeModal(); });
  const adminBtn = $('#adminBtn');
  if (adminBtn) adminBtn.addEventListener('click', ()=>{
    const code = window.prompt('أدخل رمز الوصول إلى لوحة الإدارة:');
    if (code !== '1222wqqqsugknwjigp') { toast('رمز الوصول غير صحيح', 'error'); return; }
    window.location.href = '/admin.html';
  });
});

let debounceTimer;
function debounce(fn, delay){ return function(){ clearTimeout(debounceTimer); debounceTimer=setTimeout(fn,delay); } }