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

const session = JSON.parse(localStorage.getItem('ileco3_session') || 'null');
if(!session){ location.href = 'login.html'; }

// After a full page load, Firebase needs a moment to restore the signed-in
// user from the last page — wait for that before trying to use it.
function waitForAuthUser_(){
  return new Promise(resolve => {
    if(auth.currentUser){ resolve(auth.currentUser); return; }
    const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
  });
}

async function changePassword(username, oldPassword, newPassword){
  try{
    const user = await waitForAuthUser_();
    if(!user) return { ok:false, error:'Your session expired — please log out and in again.' };
    const email = usernameToEmail_(username);
    // Firebase requires a recent login to change a password — re-authenticate
    // with the current password first (this also verifies it's correct).
    const cred = firebase.auth.EmailAuthProvider.credential(email, oldPassword);
    const result = await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPassword);
    const doc = await fdb.collection('users').doc(result.user.uid).get();
    const role = doc.exists ? doc.data().role : session.role;
    await fdb.collection('users').doc(result.user.uid).update({ mustChangePassword:false });
    await fdb.collection('activityLog').add({ username, role, action:'Changed password', details:'', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    return { ok:true };
  }catch(err){
    const msg = err.code === 'auth/wrong-password' ? 'Current password is incorrect.'
              : err.code === 'auth/weak-password' ? 'New password must be at least 8 characters.'
              : err.message;
    return { ok:false, error: msg };
  }
}

const form = document.getElementById('cp-form');
const msg = document.getElementById('cp-msg');
const btn = document.getElementById('cp-btn');

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  msg.style.display = 'none';
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if(newPassword.length < 8){
    msg.className = 'msg-box error'; msg.textContent = 'New password must be at least 8 characters.'; msg.style.display=''; return;
  }
  if(newPassword !== confirmPassword){
    msg.className = 'msg-box error'; msg.textContent = 'New password and confirmation do not match.'; msg.style.display=''; return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';
  try{
    const result = await changePassword(session.username, oldPassword, newPassword);
    if(!result.ok){
      msg.className = 'msg-box error'; msg.textContent = result.error || 'Could not change password.'; msg.style.display='';
      btn.disabled = false; btn.textContent = 'Save new password';
      return;
    }
    msg.className = 'msg-box ok'; msg.textContent = 'Password updated — redirecting…'; msg.style.display='';
    setTimeout(()=>{
      location.href = session.role === 'admin' ? 'admin.html' : (session.role === 'field' ? 'field.html' : 'index.html');
    }, 900);
  }catch(err){
    msg.className = 'msg-box error'; msg.textContent = 'Could not reach the login service: ' + err.message; msg.style.display='';
    btn.disabled = false; btn.textContent = 'Save new password';
  }
});
