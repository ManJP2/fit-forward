import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const logoutBtn = document.getElementById('logout-btn');
const summaryContent = document.getElementById('summary-content');
const summaryLoading = document.getElementById('summary-loading');
const summaryEmpty = document.getElementById('summary-empty');
const exercisesCountEl = document.getElementById('exercises-count');
const setsCompletedCountEl = document.getElementById('sets-completed-count');

const fetchAndDisplaySummary = async (user) => {
  summaryLoading.classList.remove('hidden');
  summaryContent.classList.add('hidden');
  summaryEmpty.classList.add('hidden');

  const today = new Date().toISOString().split('T')[0];
  const logsCol = collection(db, "workout_logs");
  const q = query(logsCol, where("userId", "==", user.uid), where("date", "==", today));

  try {
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      summaryEmpty.classList.remove('hidden');
    } else {
      let exercisesCount = querySnapshot.size;
      let setsCompletedCount = 0;

      querySnapshot.forEach(doc => {
        const log = doc.data();
        const completedSets = log.sets.filter(set => set.done).length;
        setsCompletedCount += completedSets;
      });

      exercisesCountEl.textContent = exercisesCount;
      setsCompletedCountEl.textContent = setsCompletedCount;
      summaryContent.classList.remove('hidden');
    }
  } catch (error) {
    console.error("Error fetching summary: ", error);
    summaryEmpty.textContent = "Error loading stats.";
    summaryEmpty.classList.remove('hidden');
  } finally {
    summaryLoading.classList.add('hidden');
  }
};

logoutBtn.addEventListener('click', () => {
  signOut(auth).then(() => {
    // Sign-out successful.
    window.location.href = 'index.html';
  }).catch((error) => {
    console.error("Sign out error", error);
  });
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    fetchAndDisplaySummary(user);
  } else {
    // User is signed out, handled by auth-guard
  }
});