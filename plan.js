// plan.js
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from((r||document).querySelectorAll(s));

const params = new URLSearchParams(location.search);
const planId = params.get('planId');
const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
if(!cu) location.href = 'index.html';
const uid = cu.uid;

const PLANS_KEY = 'local_plans_v3';
const LOGS_KEY = 'local_logs_v3';

function loadPlans(){ return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]'); }
function loadLogs(){ return JSON.parse(localStorage.getItem(LOGS_KEY) || '{}'); }
function saveLogs(obj){ localStorage.setItem(LOGS_KEY, JSON.stringify(obj)); }

const planTitle = $('#plan-title');
const planMeta = $('#plan-meta');
const monthsList = $('#months-list');
const entryModal = $('#entry-modal');
const entryDetailBody = $('#entry-detail-body');
const closeEntryDetail = $('#close-entry-detail');

const plans = loadPlans();
const plan = plans.find(p=> p.id === planId);
if(!plan){ planTitle.textContent = 'Plan not found'; monthsList.innerHTML=''; }
else {
  planTitle.textContent = plan.name;
  planMeta.textContent = `Owner: ${plan.ownerId === uid ? 'You' : plan.ownerId} • SharedWith: ${plan.sharedWith?.length || 0}`;
  loadAndRenderLogs();
}

function loadAndRenderLogs(){
  monthsList.innerHTML = '';
  const logs = loadLogs();
  const entries = (logs[uid] || {})[planId] || [];
  if(entries.length === 0){ monthsList.innerHTML = `<div class="muted">ยังไม่มีบันทึก</div>`; return; }

  // group by month (YYYY-MM)
  const byMonth = entries.reduce((acc,e)=>{
    const m = e.date.slice(0,7);
    (acc[m] = acc[m]||[]).push(e);
    return acc;
  },{});
  Object.keys(byMonth).sort((a,b)=> b.localeCompare(a)).forEach(month=>{
    const mDiv = document.createElement('div'); mDiv.className='month-item';
    const [year,mon] = month.split('-');
    mDiv.innerHTML = `<div class="month-header"><div><strong>${mon}-${year}</strong><div class="muted">${byMonth[month].length} entries</div></div>
      <div><button class="btn secondary-btn toggle-month" data-month="${month}">Open</button></div></div>`;
    const dayList = document.createElement('div'); dayList.style.display='none';
    byMonth[month].sort((a,b)=> b.date.localeCompare(a.date)).forEach(entry=>{
      const d = document.createElement('div'); d.className='day-item';
      d.innerHTML = `<div><strong>${entry.date}</strong><div class="muted">${entry.name}</div></div>
        <div class="row">
          <button class="btn secondary-btn view-entry" data-id="${entry.id}">View</button>
          ${entry.userId===uid? `<button class="btn secondary-btn edit-entry" data-id="${entry.id}">Edit</button>` : ''}
        </div>`;
      dayList.appendChild(d);
    });
    monthsList.appendChild(mDiv); monthsList.appendChild(dayList);
  });

  $$('.toggle-month', monthsList).forEach(btn=> btn.addEventListener('click', ()=>{
    const cont = btn.closest('.month-item').nextElementSibling;
    cont.style.display = cont.style.display === 'none' ? 'block' : 'none';
  }));

  $$('.view-entry', monthsList).forEach(btn=> btn.addEventListener('click', ()=> openEntry(btn.dataset.id)));
  $$('.edit-entry', monthsList).forEach(btn=> btn.addEventListener('click', ()=> {
    // edit: redirect to profile and open edit modal
    localStorage.setItem('editingPlanEntry', JSON.stringify({ planId, entryId: btn.dataset.id }));
    window.location.href = 'profile.html';
  }));
}

function openEntry(entryId){
  const logs = loadLogs();
  const entries = (logs[uid]||{})[planId]||[];
  const e = entries.find(x=> x.id === entryId);
  if(!e) return alert('Entry not found');
  entryModal.classList.remove('hidden');
  $('#entry-modal-title').textContent = `${e.date} — ${e.name}`;
  entryDetailBody.innerHTML = `<div class="muted">Performed by: ${e.userId}</div>
    <ul>${e.sets.map((s,i)=>`<li>Set ${i+1}: ${s.weight} kg × ${s.reps} reps</li>`).join('')}</ul>`;
}

closeEntryDetail.addEventListener('click', ()=> entryModal.classList.add('hidden'));
entryModal.addEventListener('click',(e)=> { if(e.target === entryModal) entryModal.classList.add('hidden'); });
