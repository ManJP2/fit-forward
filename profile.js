// profile.js
import { exerciseNames } from './exercises-data.js';
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// initialize firebase (only for signOut ability)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Helpers
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from((r||document).querySelectorAll(s));
const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
if(!cu) location.href = 'index.html';
const uid = cu.uid;

// Storage keys & helpers
const PLANS_KEY = 'local_plans_v3'; // array of plans
const LOGS_KEY = 'local_logs_v3';   // object mapping uid -> { planId: [ entries ] }

function loadPlans(){ return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]'); }
function savePlans(arr){ localStorage.setItem(PLANS_KEY, JSON.stringify(arr)); }
function loadLogs(){ return JSON.parse(localStorage.getItem(LOGS_KEY) || '{}'); }
function saveLogs(obj){ localStorage.setItem(LOGS_KEY, JSON.stringify(obj)); }

function idGen(pref='id'){ return pref + '_' + Date.now() + '_' + Math.floor(Math.random()*1000); }
function fmtDMY(dateStr){ const [y,m,d]=dateStr.split('-'); return `${d}-${m}-${y}`; }

// DOM
const userInfo = $('#user-info');
const logoutBtn = $('#logout-btn');
const createPlanBtn = $('#create-plan-btn');
const planModal = $('#plan-modal');
const planNameInput = $('#plan-name-input');
const savePlanBtn = $('#save-plan-btn');
const cancelPlanBtn = $('#cancel-plan-btn');
const planSelector = $('#plan-selector');
const planActions = $('#plan-actions');
const openPlanBtn = $('#open-plan-btn');
const deletePlanBtn = $('#delete-plan-btn');
const sharePlanBtn = $('#share-plan-btn');
const planPreview = $('#plan-preview');
const planPreviewName = $('#plan-preview-name');
const planMeta = $('#plan-meta');
const logSection = $('#log-section');
const addLogBtn = $('#add-log-btn');
const logsList = $('#logs-list');
const exportAllCsvBtn = $('#export-all-csv');
const exportPlanCsvBtn = $('#export-plan-csv');

// share
const shareModal = $('#share-modal');
const shareUidInput = $('#share-uid-input');
const saveShareBtn = $('#save-share-btn');
const closeShareBtn = $('#close-share-btn');

// log modal
const logModal = $('#log-modal');
const logModalTitle = $('#log-modal-title');
const logDate = $('#log-date');
const logExercise = $('#log-exercise');
const autocompleteList = $('#autocomplete-list');
const entrySetsContainer = $('#entry-sets-container');
const logAddSetBtn = $('#log-add-set');
const saveLogBtn = $('#save-log-btn');
const cancelLogBtn = $('#cancel-log-btn');

let editingEntry = null; // { planId, entryId }

// show user
userInfo.innerHTML = `<strong>${cu.displayName}</strong><div class="muted">UID: ${cu.uid}</div>`;

// Logout
logoutBtn.addEventListener('click', async ()=>{ try{ await signOut(auth); }catch(e){} localStorage.removeItem('currentUser'); location.href='index.html'; });

// Create plan
createPlanBtn.addEventListener('click', ()=> { planModal.classList.remove('hidden'); planNameInput.value=''; });
cancelPlanBtn.addEventListener('click', ()=> planModal.classList.add('hidden'));
savePlanBtn.addEventListener('click', ()=>{
  const name = planNameInput.value.trim();
  if(!name) return alert('กรุณาใส่ชื่อแผน');
  const plans = loadPlans();
  const newPlan = { id: idGen('plan'), name, ownerId: uid, sharedWith: [], createdAt: new Date().toISOString() };
  plans.push(newPlan);
  savePlans(plans);
  planModal.classList.add('hidden');
  renderPlanSelector();
});

// Render plan selector (show owned + shared)
function renderPlanSelector(){
  planSelector.innerHTML = `<option value="">-- เลือกแผน --</option>`;
  const plans = loadPlans();
  const visible = plans.filter(p => p.ownerId === uid || (p.sharedWith && p.sharedWith.includes(uid)));
  visible.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} ${p.ownerId===uid? '(mine)': '(shared)'}`;
    planSelector.appendChild(opt);
  });
}
renderPlanSelector();

planSelector.addEventListener('change', ()=>{
  const pid = planSelector.value;
  if(!pid){ planActions.classList.add('hidden'); planPreview.classList.add('hidden'); logSection.classList.add('hidden'); return; }
  planActions.classList.remove('hidden');
  const plans = loadPlans();
  const plan = plans.find(p=>p.id===pid);
  planPreview.classList.remove('hidden');
  planPreviewName.textContent = plan.name;
  planMeta.textContent = `Owner: ${plan.ownerId===uid? 'You': plan.ownerId} • SharedWith: ${plan.sharedWith?.length||0}`;
  openPlanBtn.onclick = ()=> window.location.href = `plan.html?planId=${pid}`;
  sharePlanBtn.onclick = ()=>{
    if(plan.ownerId !== uid) return alert('เฉพาะเจ้าของแผนเท่านั้นที่สามารถแชร์ได้');
    shareModal.classList.remove('hidden');
    shareUidInput.value = '';
    shareUidInput.dataset.planId = pid;
  };
  deletePlanBtn.onclick = ()=> {
    if(!confirm('ลบแผนนี้?')) return;
    const plans = loadPlans();
    const idx = plans.findIndex(p=>p.id===pid);
    if(idx>-1) plans.splice(idx,1);
    savePlans(plans);
    const logs = loadLogs();
    if(logs[uid] && logs[uid][pid]) delete logs[uid][pid];
    saveLogs(logs);
    renderPlanSelector();
    planActions.classList.add('hidden'); planPreview.classList.add('hidden'); logSection.classList.add('hidden');
  };

  renderLogsPreview(pid);
  logSection.classList.remove('hidden');
});

// Share
saveShareBtn.addEventListener('click', ()=>{
  const targetUid = shareUidInput.value.trim();
  const pid = shareUidInput.dataset.planId;
  if(!targetUid) return alert('กรอก UID ที่ต้องการแชร์');
  const plans = loadPlans();
  const plan = plans.find(p=>p.id===pid);
  if(!plan) return alert('ไม่พบแผน');
  plan.sharedWith = plan.sharedWith || [];
  if(!plan.sharedWith.includes(targetUid)) plan.sharedWith.push(targetUid);
  savePlans(plans);
  shareModal.classList.add('hidden');
  renderPlanSelector();
});
closeShareBtn.addEventListener('click', ()=> shareModal.classList.add('hidden'));

// Render logs preview grouped by month -> days
function renderLogsPreview(planId){
  const logsObj = loadLogs();
  const userLogs = logsObj[uid] || {};
  const entries = userLogs[planId] || [];
  const container = $('#months-root');
  container.innerHTML = '';
  const list = $('#logs-list'); list.innerHTML='';

  if(entries.length === 0){
    list.innerHTML = `<div class="muted">ยังไม่มีบันทึก</div>`;
    return;
  }

  // group entries into months -> days
  const grouped = {}; // { 'YYYY-MM': { 'DD': [entries] } }
  entries.forEach(e=>{
    const [y,m,d] = e.date.split('-');
    const monthKey = `${y}-${m}`;
    if(!grouped[monthKey]) grouped[monthKey]={};
    if(!grouped[monthKey][d]) grouped[monthKey][d]=[];
    grouped[monthKey][d].push(e);
  });

  // build UI: months
  Object.keys(grouped).sort((a,b)=> b.localeCompare(a)).forEach(monthKey=>{
    const [y,m] = monthKey.split('-');
    const monthEl = document.createElement('div');
    monthEl.className = 'month';
    monthEl.innerHTML = `<div class="month-header"><strong>เดือน ${m}-${y}</strong><span class="muted">${Object.keys(grouped[monthKey]).length} วัน</span></div>`;
    const daysWrap = document.createElement('div'); daysWrap.className='day-list';
    Object.keys(grouped[monthKey]).sort((a,b)=> b.localeCompare(a)).forEach(day=>{
      const dayBtn = document.createElement('div');
      dayBtn.style.padding='8px';
      dayBtn.style.borderBottom='1px dashed #eee';
      dayBtn.style.cursor='pointer';
      dayBtn.innerHTML = `<strong>${day}-${m}-${y}</strong> <span class="muted"> (${grouped[monthKey][day].length} ท่า)</span>`;
      dayBtn.addEventListener('click', ()=> {
        // show entries for this day in logs list
        showEntriesList(grouped[monthKey][day], planId);
      });
      daysWrap.appendChild(dayBtn);
    });
    monthEl.appendChild(daysWrap);
    container.appendChild(monthEl);
  });
}

// show entries for a specific date (day)
function showEntriesList(entries, planId){
  const list = $('#logs-list');
  list.innerHTML = '';
  entries.forEach(e=>{
    const li = document.createElement('div'); li.className='log-item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${e.name}</strong><div class="log-meta">${fmtDMY(e.date)} • ${e.sets.length} เซต</div>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.gap='6px';
    const viewBtn = document.createElement('button'); viewBtn.className='btn secondary-btn'; viewBtn.textContent='View';
    viewBtn.addEventListener('click', ()=> openEntryDetailModal(planId, e.id));
    right.appendChild(viewBtn);
    if(e.userId === uid){
      const editBtn = document.createElement('button'); editBtn.className='btn secondary-btn'; editBtn.textContent='Edit';
      editBtn.addEventListener('click', ()=> openLogModalForEdit(planId, e.id));
      const delBtn = document.createElement('button'); delBtn.className='btn secondary-btn'; delBtn.textContent='Delete';
      delBtn.addEventListener('click', ()=> {
        if(!confirm('ลบ entry นี้?')) return;
        const logs = loadLogs();
        logs[uid][planId] = (logs[uid][planId] || []).filter(en => en.id !== e.id);
        saveLogs(logs);
        renderLogsPreview(planId);
      });
      right.appendChild(editBtn); right.appendChild(delBtn);
    }
    li.appendChild(left); li.appendChild(right);
    $('#logs-list').appendChild(li);
  });
}

// open entry detail (read-only)
function openEntryDetailModal(planId, entryId){
  const logs = loadLogs();
  const entries = (logs[uid]||{})[planId]||[];
  const e = entries.find(x=>x.id===entryId);
  if(!e) return alert('ไม่พบ entry');
  logModal.classList.remove('hidden');
  logModalTitle.textContent = `Details: ${e.name} (${fmtDMY(e.date)})`;
  logDate.value = e.date;
  logExercise.value = e.name;
  clearEntrySets();
  e.sets.forEach(s=> addEntrySet(s.weight, s.reps));
  $$('.entry-weight', entrySetsContainer).forEach(i=>i.disabled=true);
  $$('.entry-reps', entrySetsContainer).forEach(i=>i.disabled=true);
  $$('.remove-set', entrySetsContainer).forEach(b=>b.style.display='none');
  saveLogBtn.style.display='none';
}

// Add new log
addLogBtn.addEventListener('click', ()=>{
  const pid = planSelector.value;
  if(!pid) return alert('เลือกแผนก่อน');
  editingEntry = null;
  logModal.classList.remove('hidden');
  logModalTitle.textContent = 'Add Workout Log';
  logDate.value = new Date().toISOString().split('T')[0];
  logExercise.value = '';
  clearEntrySets();
  addEntrySet();
  $$('.entry-weight', entrySetsContainer).forEach(i=>i.disabled=false);
  $$('.entry-reps', entrySetsContainer).forEach(i=>i.disabled=false);
  $$('.remove-set', entrySetsContainer).forEach(b=>b.style.display='inline-block');
  saveLogBtn.style.display='inline-block';
});

// entry set helpers
function clearEntrySets(){ entrySetsContainer.innerHTML=''; }
function addEntrySet(weight='', reps=''){
  const div = document.createElement('div'); div.className='entry-set';
  div.innerHTML = `<input type="number" class="entry-weight" placeholder="น้ำหนัก (kg)" value="${weight}" />
                   <input type="number" class="entry-reps" placeholder="reps" value="${reps}" />
                   <button class="remove-set btn secondary-btn">ลบ</button>`;
  entrySetsContainer.appendChild(div);
  div.querySelector('.remove-set').addEventListener('click', ()=> div.remove());
}
logAddSetBtn.addEventListener('click', ()=> addEntrySet());
cancelLogBtn.addEventListener('click', ()=> { logModal.classList.add('hidden'); editingEntry=null; });

// autocomplete for exercise
let localExerciseList = [...exerciseNames];
function renderAutocomplete(val){
  autocompleteList.innerHTML='';
  if(!val) return;
  const matches = localExerciseList.filter(n=>n.toLowerCase().includes(val.toLowerCase())).slice(0,12);
  matches.forEach(m=>{
    const li = document.createElement('li'); li.textContent = m;
    li.addEventListener('click', ()=> { logExercise.value = m; autocompleteList.innerHTML=''; });
    autocompleteList.appendChild(li);
  });
  if(!localExerciseList.some(n=> n.toLowerCase()=== val.toLowerCase())){
    const li = document.createElement('li'); li.className='add-new-exercise';
    li.textContent = `➕ เพิ่มท่าใหม่: "${val}"`;
    li.addEventListener('click', ()=>{ localExerciseList.unshift(val.trim()); logExercise.value = val.trim(); autocompleteList.innerHTML=''; });
    autocompleteList.appendChild(li);
  }
}
logExercise.addEventListener('input', ()=> renderAutocomplete(logExercise.value));
document.addEventListener('click', (e)=> { if(!autocompleteList.contains(e.target) && e.target!==logExercise) autocompleteList.innerHTML=''; });

// Save (create or edit)
saveLogBtn.addEventListener('click', ()=>{
  const pid = planSelector.value;
  if(!pid) return alert('เลือกแผนก่อน');
  const name = logExercise.value.trim();
  const date = logDate.value;
  if(!name || !date) return alert('กรุณากรอกวันที่และชื่อท่า');
  const setsEls = $$('.entry-set', entrySetsContainer);
  const sets = [];
  setsEls.forEach(s=>{
    const w = parseFloat(s.querySelector('.entry-weight').value) || 0;
    const r = parseInt(s.querySelector('.entry-reps').value) || 0;
    if(r>0) sets.push({ weight: w, reps: r });
  });
  if(sets.length===0) return alert('ต้องมีอย่างน้อย 1 เซตที่มี reps');

  const logs = loadLogs();
  if(!logs[uid]) logs[uid] = {};
  if(!logs[uid][pid]) logs[uid][pid] = [];

  if(editingEntry){
    const ent = logs[uid][editingEntry.planId].find(en=>en.id===editingEntry.entryId);
    if(!ent) return alert('Entry not found');
    ent.name = name; ent.date = date; ent.sets = sets; ent.updatedAt = new Date().toISOString();
  } else {
    logs[uid][pid].push({ id: idGen('entry'), userId: uid, date, name, sets, createdAt: new Date().toISOString() });
  }
  saveLogs(logs);
  logModal.classList.add('hidden'); editingEntry=null;
  renderLogsPreview(pid);
});

// open edit
function openLogModalForEdit(planId, entryId){
  const logs = loadLogs();
  const entries = (logs[uid]||{})[planId]||[];
  const e = entries.find(x=>x.id===entryId);
  if(!e) return alert('Entry not found');
  editingEntry = { planId, entryId };
  logModal.classList.remove('hidden');
  logModalTitle.textContent = 'Edit Workout Log';
  logDate.value = e.date;
  logExercise.value = e.name;
  clearEntrySets();
  e.sets.forEach(s=> addEntrySet(s.weight, s.reps));
  $$('.entry-weight', entrySetsContainer).forEach(i=>i.disabled=false);
  $$('.entry-reps', entrySetsContainer).forEach(i=>i.disabled=false);
  $$('.remove-set', entrySetsContainer).forEach(b=>b.style.display='inline-block');
  saveLogBtn.style.display='inline-block';
}

// CSV export
function exportPlanCSV(planId){
  const plans = loadPlans();
  const plan = plans.find(p=>p.id===planId);
  if(!plan) return alert('Plan not found');
  const logs = loadLogs();
  const entries = (logs[uid]||{})[planId]||[];
  if(entries.length===0) return alert('ไม่มีข้อมูลให้ export');
  const rows = ['date,exercise,weight,reps,set,userId'];
  entries.forEach(en=>{
    en.sets.forEach((s,i)=> rows.push(`${en.date},${escapeCsv(en.name)},${s.weight},${s.reps},${i+1},${en.userId}`));
  });
  downloadCSV(rows.join('\n'), `${plan.name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`);
}
function escapeCsv(v){ if(v==null) return ''; return `"${String(v).replace(/"/g,'""')}"`; }
function downloadCSV(content, filename){ const blob=new Blob([content],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

exportAllCsvBtn.addEventListener('click', ()=>{
  const plans = loadPlans().filter(p=>p.ownerId===uid);
  if(plans.length===0) return alert('You have no plans to export');
  const rows = ['plan,date,exercise,weight,reps,set,userId'];
  const logs = loadLogs();
  plans.forEach(plan=>{
    const entries = (logs[uid]||{})[plan.id]||[];
    entries.forEach(en=>{
      en.sets.forEach((s,i)=> rows.push(`${escapeCsv(plan.name)},${en.date},${escapeCsv(en.name)},${s.weight},${s.reps},${i+1},${en.userId}`));
    });
  });
  if(rows.length===1) return alert('No logs to export');
  downloadCSV(rows.join('\n'), `all_plans_${uid}_${new Date().toISOString().slice(0,10)}.csv`);
});
exportPlanCsvBtn.addEventListener('click', ()=>{
  const pid = planSelector.value;
  if(!pid) return alert('เลือกแผนก่อน');
  exportPlanCSV(pid);
});

// initial render
renderPlanSelector();

// auto-select if single plan visible
(function autoSelectIfOne(){
  const plans = loadPlans();
  const visible = plans.filter(p => p.ownerId === uid || (p.sharedWith && p.sharedWith.includes(uid)));
  if(visible.length === 1){
    planSelector.value = visible[0].id;
    planSelector.dispatchEvent(new Event('change'));
  }
})();

// modal background click closes
logModal.addEventListener('click', (e)=>{ if(e.target === logModal){ logModal.classList.add('hidden'); editingEntry=null; }});
planModal.addEventListener('click', (e)=> { if(e.target === planModal) planModal.classList.add('hidden'); });
shareModal.addEventListener('click', (e)=> { if(e.target === shareModal) shareModal.classList.add('hidden'); });
