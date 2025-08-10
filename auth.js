// auth.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById("login-form");
const errEl = document.getElementById("error-message");
const googleBtn = document.getElementById("google-login");
const facebookBtn = document.getElementById("facebook-login");

function showError(msg){
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  errEl.style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, loginForm.email.value.trim(), loginForm.password.value);
    window.location.href = "profile.html";
  } catch (err) {
    showError(err.message);
  }
});

googleBtn.addEventListener("click", async ()=>{
  errEl.style.display = 'none';
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    window.location.href = "profile.html";
  } catch (err) {
    showError(err.message);
  }
});

facebookBtn.addEventListener("click", async ()=>{
  errEl.style.display = 'none';
  try {
    const provider = new FacebookAuthProvider();
    await signInWithPopup(auth, provider);
    window.location.href = "profile.html";
  } catch (err) {
    showError(err.message);
  }
});
