
window.navigate = function (url) {
  document.getElementById("content-frame").src = url;
};

window.toggleMenu = function (id) {
  const el = document.getElementById(id);
  el.style.display = (el.style.display === "none") ? "block" : "none";
};

window.logout = function () {
  localStorage.removeItem("nickname");
  window.location.href = "login.html";
};

window.onload = function () {
  const nickname = localStorage.getItem("nickname") || "使用者";
  document.getElementById("nickname-display").textContent = `🙋‍♂️ 使用者：${nickname}`;
};

// === 環境整理（clean-cycle）紅圈提示（包含「過期 + 0~2天內到期」） ===
import { db } from '/js/firebase.js'
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

function __badge_floorDays(ms){ return Math.floor(ms / 86400000) }
async function __badge_countEnvWaiting(){
  try{
    const snap = await getDocs(collection(db,'cleanCycleTasks'))
    const now = new Date()
    let waiting=0
    snap.forEach(doc=>{
      const d=doc.data()||{}
      const lastIso=d.last, days=parseInt(d.days||0,10)
      if(!lastIso||!days) return
      const last=new Date(lastIso)
      const dueAt=new Date(last.getTime()+days*86400000)
      const daysLeft=__badge_floorDays(dueAt-now)
      if(daysLeft <= 2) waiting++   // ✅ 過期(負數) 也算進去
    })
    return waiting
  }catch(e){console.warn('[badge] countEnvWaiting failed',e);return 0}
}
function __badge_set(n){
  const el=document.getElementById('cycle-badge')
  if(!el) return
  if(n>0){ el.textContent=String(n); el.style.display='inline-flex' }
  else{ el.style.display='none' }
}
async function __badge_update(){
  const n=await __badge_countEnvWaiting()
  __badge_set(n)
}
window.addEventListener('load', __badge_update)
setInterval(__badge_update, 3*60*60*1000)
