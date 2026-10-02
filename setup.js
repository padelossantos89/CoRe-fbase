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
function usernameToEmail_(username){ return username.trim().toLowerCase() + '@ileco3.local'; }

/* Whether an admin account already exists. Checked fresh every time this
   page loads — never cached — so a stale local flag can't reopen setup. */
// Reads a single public true/false flag (safe for anyone, even signed out,
// to read — see firestore.rules) instead of querying the users collection
// directly, which requires being logged in and would fail here since nobody
// is logged in yet at this point.
async function hasAnyAccounts(){
  const doc = await fdb.collection('meta').doc('status').get();
  return !!(doc.exists && doc.data().hasUsers);
}

async function createFirstAdmin(username, password){
  if(await hasAnyAccounts()) return { ok:false, error:'An admin account already exists.' };
  try{
    const cred = await auth.createUserWithEmailAndPassword(usernameToEmail_(username), password);
    await fdb.collection('users').doc(cred.user.uid).set({
      username, role:'admin', mustChangePassword:false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await fdb.collection('meta').doc('status').set({ hasUsers:true });
    await fdb.collection('activityLog').add({ username, role:'admin', action:'Created the admin account (first-time setup)', details:'', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    return { ok:true };
  }catch(err){
    const msg = err.code === 'auth/email-already-in-use' ? 'That username already exists.'
              : err.code === 'auth/weak-password' ? 'Password must be at least 8 characters.'
              : err.message;
    return { ok:false, error: msg };
  }
}

const checkingCard = document.getElementById('checking-card');
const doneCard = document.getElementById('done-card');
const form = document.getElementById('setup-form');
const msg = document.getElementById('setup-msg');
const btn = document.getElementById('setup-btn');

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  msg.style.display = 'none';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if(!username){ msg.className='msg-box error'; msg.textContent='Please enter a username.'; msg.style.display=''; return; }
  if(password.length < 8){
    msg.className = 'msg-box error'; msg.textContent = 'Password must be at least 8 characters.'; msg.style.display=''; return;
  }
  if(password !== confirmPassword){
    msg.className = 'msg-box error'; msg.textContent = 'Password and confirmation do not match.'; msg.style.display=''; return;
  }

  btn.disabled = true; btn.textContent = 'Creating…';
  try{
    const result = await createFirstAdmin(username, password);
    if(!result.ok){
      msg.className = 'msg-box error'; msg.textContent = result.error || 'Could not create the admin account.'; msg.style.display='';
      btn.disabled = false; btn.textContent = 'Create admin account';
      return;
    }
    localStorage.setItem('ileco3_session', JSON.stringify({
      username, role:'admin', loginAt:new Date().toISOString()
    }));
    msg.className = 'msg-box ok'; msg.textContent = 'Admin account created — taking you in…'; msg.style.display='';
    setTimeout(()=>{ location.href = 'admin.html'; }, 800);
  }catch(err){
    msg.className = 'msg-box error'; msg.textContent = 'Could not reach the login service: ' + err.message; msg.style.display='';
    btn.disabled = false; btn.textContent = 'Create admin account';
  }
});

/* Always re-check the server before showing the form — this page must
   never trust a locally-cached "setup needed" assumption. */
(async function init(){
  try{
    const exists = await hasAnyAccounts();
    checkingCard.style.display = 'none';
    if(exists){
      doneCard.style.display = '';
    } else {
      form.style.display = '';
    }
  }catch(err){
    checkingCard.querySelector('.sub').textContent = 'Could not reach the login service: ' + err.message;
  }
})();
