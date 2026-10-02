/* =========================================================================
   CONFIGURATION
   Paste the deployed Google Apps Script Web App URL for AuthCode.gs below.
   Leave blank to run in demo mode: no admin account exists until someone
   completes first-time setup below, same as live mode.
   ========================================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBJOfUc76neQC6e9KkiVkSxGvXLmo5J74Q",
  authDomain: "ileco-iii-core.firebaseapp.com",
  projectId: "ileco-iii-core",
  storageBucket: "ileco-iii-core.firebasestorage.app",
  messagingSenderId: "319768694684",
  appId: "1:319768694684:web:ba0f169facd757af44c259"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const fdb = firebase.firestore();

// Firebase Auth needs an email; staff still just type a username.
// This turns "bendecio" into "bendecio@ileco3.local" behind the scenes.
function usernameToEmail_(username){ return username.trim().toLowerCase() + '@ileco3.local'; }

function isLive(){ return true; }

async function logActivity(username, role, action, details){
  try{ await fdb.collection('activityLog').add({ username, role, action, details: details||'', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
  catch(e){ /* activity logging is best-effort, never blocks the user */ }
}

/* Whether ANY account exists yet — decides whether to show the normal
   username/password form or the one-time setup path. Never reveals who
   any account belongs to, only whether the users collection is empty. */
async function hasAnyAccounts(){
  try{
    const doc = await fdb.collection('meta').doc('status').get();
    return !!(doc.exists && doc.data().hasUsers);
  }catch(err){ return true; } // fail closed: show the normal login form, not setup
}

// The person always sees one generic message on failure, whichever of these
// is the real cause — this is deliberate: telling someone specifically
// "that username doesn't exist" vs "wrong password" lets an attacker test
// thousands of usernames and learn which ones are real accounts, without
// ever needing a correct password (this is called username enumeration).
// The REAL reason is still recorded, but only in the Activity Log, which
// only an admin who is already logged in can see.
async function logFailedLogin_(username, reason){
  try{
    await fdb.collection('activityLog').add({
      username, role:'(unknown)', action:'Failed login attempt', details:reason,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(e){ /* best-effort */ }
}

async function login(username, password){
  try{
    const cred = await auth.signInWithEmailAndPassword(usernameToEmail_(username), password);
    const doc = await fdb.collection('users').doc(cred.user.uid).get();
    if(!doc.exists){
      logFailedLogin_(username, 'Signed in but has no profile on file');
      return { ok:false, error:'Incorrect username or password.' };
    }
    const data = doc.data();
    logActivity(data.username, data.role, 'Logged in', '');
    return { ok:true, role: data.role, mustChangePassword: !!data.mustChangePassword };
  }catch(err){
    const reason = err.code === 'auth/user-not-found' ? 'Username does not exist'
                 : err.code === 'auth/wrong-password' ? 'Wrong password'
                 : err.code === 'auth/too-many-requests' ? 'Too many attempts — temporarily locked by Firebase'
                 : `Wrong username or password (${err.code || err.message})`;
    logFailedLogin_(username, reason);
    return { ok:false, error:'Incorrect username or password.' };
  }
}

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const btn = document.getElementById('login-btn');

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  errorBox.style.display = 'none';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if(!username || !password) return;

  btn.disabled = true; btn.textContent = 'Signing in…';
  try{
    const result = await login(username, password);
    if(!result.ok){
      errorBox.textContent = result.error || 'Incorrect username or password.';
      errorBox.style.display = '';
      btn.disabled = false; btn.textContent = 'Log in';
      return;
    }
    localStorage.setItem('ileco3_session', JSON.stringify({
      username, role: result.role, loginAt: new Date().toISOString()
    }));
    if(result.mustChangePassword){
      location.href = 'change-password.html';
    } else if(result.role === 'admin'){
      location.href = 'admin.html';
    } else if(result.role === 'field'){
      location.href = 'field.html';
    } else {
      location.href = 'index.html';
    }
  }catch(err){
    errorBox.textContent = 'Could not reach the login service: ' + err.message;
    errorBox.style.display = '';
    btn.disabled = false; btn.textContent = 'Log in';
  }
});

const setupCard = document.getElementById('setup-card');

/* If already logged in, skip straight past the login screen. Otherwise
   check whether any account exists yet, and show the setup card (first
   run) or the normal username/password form. */
(function init(){
  const session = JSON.parse(localStorage.getItem('ileco3_session') || 'null');
  if(session){
    location.href = session.role === 'admin' ? 'admin.html' : (session.role === 'field' ? 'field.html' : 'index.html');
    return;
  }
  hasAnyAccounts().then(exists => {
    document.getElementById('checking-card').style.display = 'none';
    if(exists){
      document.getElementById('login-form').style.display = '';
    } else {
      setupCard.style.display = '';
    }
  });
})();
