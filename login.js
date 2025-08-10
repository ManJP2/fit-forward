// login.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleBtn = document.getElementById('google-login');
const errEl = document.getElementById('login-error');

function showError(msg){
  errEl.style.display = 'block';
  errEl.textContent = msg;
}

googleBtn.addEventListener('click', async ()=>{
  try {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    const user = res.user;
    // store minimal user info in localStorage
    localStorage.setItem('currentUser', JSON.stringify({
      uid: user.uid,
      displayName: user.displayName || user.email,
      email: user.email || ''
    }));
    // redirect to profile
    location.href = 'profile.html';
  } catch (err) {
    showError(err.message || 'Google login failed');
    console.error(err);
  }
});
