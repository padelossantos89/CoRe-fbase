/* =========================================================================
   Auth guard — every page in this system requires a logged-in session.
   Paste the same AuthCode.gs Web App URL used in login.html here so
   logout can be recorded in the shared activity log.
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

let session = JSON.parse(localStorage.getItem('ileco3_session') || 'null');
// Sessions expire after 8 hours of being issued — after that, treat it as
// logged out. Protects a PC left signed in overnight or over a weekend.
const SESSION_MAX_MS_ = 8 * 60 * 60 * 1000;
if(session && (Date.now() - new Date(session.loginAt).getTime()) > SESSION_MAX_MS_){
  localStorage.removeItem('ileco3_session');
  session = null;
}
if(!session){ location.href = 'login.html'; }
else if(session.role === 'field'){ location.replace('field.html'); }
else if(session.role === 'admin'){ document.getElementById('admin-link').style.display = ''; }

async function logActivity(username, role, action, details){
  try{ await fdb.collection('activityLog').add({ username, role, action, details: details||'', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
  catch(err){ /* best-effort */ }
}

document.getElementById('logout-link').addEventListener('click', async (e)=>{
  e.preventDefault();
  if(session){ await logActivity(session.username, session.role, 'Logged out', ''); }
  try{ await auth.signOut(); }catch(e){}
  try{ Object.keys(localStorage).filter(k=>k.indexOf('ileco_rows_v1:')===0).forEach(k=>localStorage.removeItem(k)); }catch(e){}
      localStorage.removeItem('ileco3_session');
  location.href = 'login.html';
});
