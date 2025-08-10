// app.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, query, where, onSnapshot,
  getDocs, doc, updateDoc, deleteDoc, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { exerciseNames as defaultExercises } from "./exercises-data.js";

// init
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

// current user
let currentUser = null;

// helper today
const todayISO = () => new Date().toISOString().split('T')[0];

// Autocomplete helpers (used in entry modal)
function createAutocomplete(inputEl, listEl, allowAddNew=true){
  // combine default exercises + those present in Firestore could be added later
  let localList = [...defaultExercises];

  const renderMatches = (val) => {
    listEl.innerHTML = '';
    if(!val) return;
    const matches = localList.filter(n=> n.toLowerCase().includes(val.toLowerCase())).slice(0, 12);
    matches.forEach(m=>{
      const li = document.createElement('li');
      li.textContent = m;
      li.addEventListener('click', ()=>{ inputEl.value = m; listEl.innerHTML=''; });
      listEl.appendChild(li);
    });
    if(allowAddNew && !localList.some(n=> n.toLowerCase() === val.toLowerCase())){
      const li = document.createElement('li');
      li.className = 'add-new-exercise';
      li.textContent = `➕ เพิ่มท่าใหม่: "${inputEl.value}"`;
      li.addEventListener('click', ()=>{ 
        const newName = inputEl.value.trim();
        if(!newName) return;
        localList.unshift(newName);
        inputEl.value = newName;
        listEl.innerHTML='';
      });
      listEl.appendChild(li);
    }
  };

  inputEl.addEventListener('input', ()=> renderMatches(inputEl.value));
  document.addEventListener('click', (e)=>{
    if(!listEl.contains(e.target) && e.target !== inputEl) listEl.innerHTML='';
  });

  return { updateList: (arr)=> { localList = [...new Set([...arr, ...localList])]; } };
}

// AUTH state
onAuthStateChanged(auth, (user)=>{
  currentUser = user;
  if(user){
    // init profile page if present
    if(document.body.contains($('#user-info'))) initProfilePage();
    if(document.body.contains($('#plan-title'))) initPlanPage();
  } else {
    // nothing (auth-guard will redirect)
  }
});

/* ------------------ PROFILE PAGE ------------------ */
function initProfilePage(){
  $('#user-info').textContent = 'Loading...';
  const logoutBtn = $('#logout-btn');
  if(logoutBtn) logoutBtn.addEventListener('click', async ()=> { await signOut(auth); window.location.href='index.html'; });

  const u = currentUser;
  $('#user-info').innerHTML = `<strong>${u.displayName || u.email}</strong><div class="muted">UID: ${u.uid}</div>`;

  // modal controls
  const planModal = $('#plan-modal');
  const planNameInput = $('#plan-name');
  const savePlanBtn = $('#save-plan-btn');
  const closePlanModal = $('#close-plan-modal');

  $('#create-personal-plan').addEventListener('click', ()=> openPlanModal('personal'));
  $('#create-shared-plan').addEventListener('click', ()=> openPlanModal('shared'));
  closePlanModal.addEventListener('click', ()=> planModal.classList.add('hidden'));

  function openPlanModal(type){
    planModal.classList.remove('hidden');
    $('#plan-modal-title').textContent = type === 'shared' ? 'สร้างแผนสำหรับลูกค้า (Shared)' : 'สร้างแผนส่วนตัว';
    planModal.dataset.type = type;
    planNameInput.value = '';
  }

  savePlanBtn.addEventListener('click', async ()=>{
    const name = planNameInput.value.trim();
    const type = planModal.dataset.type === 'shared';
    if(!name) return alert('กรุณากรอกชื่อแผน');
    try{
      await addDoc(collection(db,'plans'), {
        name,
        ownerId: currentUser.uid,
        forOthers: type,
        createdAt: new Date().toISOString()
      });
      planModal.classList.add('hidden');
    }catch(e){ console.error(e); alert('ไม่สามารถสร้างแผนได้'); }
  });

  // Show plans (owned + shared)
  const plansListEl = $('#plans-list');
  plansListEl.innerHTML = 'Loading...';

  // Use getDocs to fetch owned + shared and render
  (async ()=>{
    try{
      const ownedSnap = await getDocs(query(collection(db,'plans'), where('ownerId','==',currentUser.uid), orderBy('createdAt','desc')));
      const sharedSnap = await getDocs(query(collection(db,'plans'), where('forOthers','==', true), orderBy('createdAt','desc')));
      const map = {};
      ownedSnap.forEach(d => map[d.id] = d.data());
      sharedSnap.forEach(d => map[d.id] = d.data());
      const entries = Object.entries(map);
      if(entries.length === 0){
        plansListEl.innerHTML = `<div class="muted">ยังไม่มีแผน ลองสร้างแผนใหม่</div>`;
        return;
      }
      plansListEl.innerHTML = '';
      entries.forEach(([id, data])=>{
        const div = document.createElement('div');
        div.className = 'plan-item';
        div.dataset.id = id;
        div.innerHTML = `<div>
            <strong>${data.name}</strong>
            <div class="muted">owner: ${data.ownerId === currentUser.uid ? 'You' : data.ownerId}</div>
          </div>
          <div class="row">
            <button class="btn secondary-btn open-plan" data-id="${id}">Open</button>
            ${data.ownerId === currentUser.uid ? `<button class="btn secondary-btn delete-plan" data-id="${id}">Delete</button>` : ''}
          </div>`;
        plansListEl.appendChild(div);
      });

      $$('.open-plan', plansListEl).forEach(btn => btn.addEventListener('click', ()=> window.location.href = `plan.html?planId=${btn.dataset.id}`));
      $$('.delete-plan', plansListEl).forEach(btn => btn.addEventListener('click', async ()=>{
        if(!confirm('ต้องการลบแผนนี้หรือไม่?')) return;
        try{ await deleteDoc(doc(db,'plans',btn.dataset.id)); }catch(e){ console.error(e); alert('ลบไม่สำเร็จ'); }
      }));
    }catch(e){ console.error(e); plansListEl.innerHTML = `<div class="muted">Error loading plans</div>`; }
  })();
}

/* ------------------ PLAN PAGE ------------------ */
function initPlanPage(){
  const params = new URLSearchParams(location.search);
  const planId = params.get('planId');
  if(!planId){ alert('No planId'); window.location.href='profile.html'; return; }

  const planTitleEl = $('#plan-title');
  const planMetaEl = $('#plan-meta');
  const monthsList = $('#months-list');

  // modal elements
  const addEntryBtn = $('#add-entry-btn');
  const entryModal = $('#entry-modal');
  const entryDate = $('#entry-date');
  const entryExercise = $('#entry-exercise');
  const autocompleteList = $('#autocomplete-list');
  const entrySetsContainer = $('#entry-sets-container');
  const entryAddSetBtn = $('#entry-add-set');
  const saveEntryBtn = $('#save-entry-btn');
  const closeEntryBtn = $('#close-entry-btn');

  // setup autocomplete for entry exercise
  const ac = createAutocomplete(entryExercise, autocompleteList, true);

  // load plan meta
  (async ()=>{
    try{
      const planDocRef = doc(db,'plans',planId);
      const planSnap = await getDoc(planDocRef);
      if(planSnap.exists()){
        const data = planSnap.data();
        planTitleEl.textContent = data.name || 'แผน';
        planMetaEl.textContent = `Created by: ${data.ownerId === currentUser.uid ? 'You' : data.ownerId}`;
      } else {
        planTitleEl.textContent = 'แผนไม่พบ';
      }
    }catch(e){ console.error(e); }
  })();

  // helper to render months grouping
  async function loadLogs(){
    monthsList.innerHTML = 'Loading...';
    try{
      const col = collection(db,'workout_logs');
      const q = query(col, where('planId','==', planId), orderBy('date','desc'));
      const snap = await getDocs(q);
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      if(rows.length === 0){
        monthsList.innerHTML = `<div class="muted">ยังไม่มีบันทึกในแผนนี้</div>`;
        return;
      }
      // group by month (YYYY-MM)
      const byMonth = rows.reduce((acc, r) => {
        const month = r.date.slice(0,7);
        acc[month] = acc[month] || [];
        acc[month].push(r);
        return acc;
      }, {});
      monthsList.innerHTML = '';
      Object.keys(byMonth).sort((a,b)=> b.localeCompare(a)).forEach(month => {
        const monthDiv = document.createElement('div');
        monthDiv.className='month-item';
        monthDiv.innerHTML = `<div><strong>${month}</strong><div class="muted">${byMonth[month].length} entries</div></div><div><button class="btn secondary-btn toggle-month" data-month="${month}">Open</button></div>`;
        monthsList.appendChild(monthDiv);
        const dayList = document.createElement('div');
        dayList.className = 'list-group';
        dayList.style.display = 'none';
        byMonth[month].sort((a,b)=> b.date.localeCompare(a.date)).forEach(entry=>{
          const dItem = document.createElement('div');
          dItem.className = 'day-item';
          dItem.innerHTML = `<div>
              <strong>${entry.date}</strong>
              <div class="muted">${entry.name} (${entry.muscleGroup || '-'})</div>
            </div>
            <div class="row">
              <button class="btn secondary-btn view-entry" data-id="${entry.id}">View</button>
            </div>`;
          dayList.appendChild(dItem);
        });
        monthsList.appendChild(dayList);
      });

      // attach handlers
      $$('.toggle-month', monthsList).forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          const month = btn.dataset.month;
          const container = btn.closest('.month-item').nextElementSibling;
          container.style.display = container.style.display === 'none' ? 'block' : 'none';
        });
      });

      $$('.view-entry', monthsList).forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.dataset.id;
          openViewEntry(id); // show modal with details
        });
      });

    }catch(e){ console.error(e); monthsList.innerHTML = `<div class="muted">Error loading logs</div>`; }
  }

  // open view entry (show sets etc.)
  async function openViewEntry(entryId){
    try{
      const docRef = doc(db,'workout_logs',entryId);
      const snap = await getDoc(docRef);
      if(!snap.exists()) return alert('Entry not found');
      const data = snap.data();
      // simple modal re-use: fill entry modal with data and set inputs disabled
      entryModal.classList.remove('hidden');
      entryDate.value = data.date;
      entryExercise.value = data.name;
      entrySetsContainer.innerHTML = '';
      (data.sets || []).forEach((s, i)=>{
        const div = document.createElement('div');
        div.className = 'entry-set';
        div.innerHTML = `<input type="number" disabled value="${s.weight}" /><input type="number" disabled value="${s.reps}" /><div class="muted">Set ${i+1}</div>`;
        entrySetsContainer.appendChild(div);
      });
      // disable save
      saveEntryBtn.style.display = 'none';
    }catch(e){ console.error(e); alert('Error opening entry'); }
  }

  // open modal to create new entry
  addEntryBtn.addEventListener('click', ()=>{
    entryModal.classList.remove('hidden');
    entryDate.value = todayISO();
    entryExercise.value = '';
    entrySetsContainer.innerHTML = '';
    addEntrySet();
    saveEntryBtn.style.display = 'inline-block';
  });

  closeEntryBtn.addEventListener('click', ()=> entryModal.classList.add('hidden'));

  function addEntrySet(){
    const div = document.createElement('div');
    div.className = 'entry-set';
    div.innerHTML = `<input type="number" class="entry-weight" placeholder="น้ำหนัก (kg)" /><input type="number" class="entry-reps" placeholder="จำนวนครั้ง" /><button class="remove-set btn secondary-btn">ลบ</button>`;
    entrySetsContainer.appendChild(div);
    div.querySelector('.remove-set').addEventListener('click', ()=> div.remove());
  }

  entryAddSetBtn.addEventListener('click', addEntrySet);

  saveEntryBtn.addEventListener('click', async ()=>{
    const name = entryExercise.value.trim();
    if(!name) return alert('กรุณากรอกชื่อท่า');
    const sets = [];
    $$('.entry-set', entrySetsContainer).forEach(el=>{
      const weightEl = el.querySelector('.entry-weight');
      const repsEl = el.querySelector('.entry-reps');
      const weight = parseFloat(weightEl.value) || 0;
      const reps = parseInt(repsEl.value) || 0;
      if(reps>0) sets.push({ weight, reps, done:false });
    });
    if(sets.length === 0) return alert('กรุณาใส่อย่างน้อย 1 เซตที่มีจำนวนครั้ง');

    try{
      await addDoc(collection(db,'workout_logs'), {
        planId,
        userId: currentUser.uid,
        date: entryDate.value || todayISO(),
        name,
        muscleGroup: '', // you can add select later
        sets,
        createdAt: new Date().toISOString()
      });
      entryModal.classList.add('hidden');
      await loadLogs(); // refresh view
    }catch(e){ console.error(e); alert('ไม่สามารถบันทึกได้'); }
  });

  // support open existing entries (view)
  async function openViewEntry(id){ /* defined earlier */ }

  // initial load
  loadLogs();
}
