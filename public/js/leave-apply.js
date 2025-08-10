import { db, auth } from '/js/firebase.js'
import { doc, getDoc, collection, addDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
function nowTPE(){ return `${fmtDate.format(new Date())} ${fmtTime.format(new Date())}` }
function toTPE(tsOrIso){
  const d = tsOrIso?.toDate ? tsOrIso.toDate() : new Date(tsOrIso)
  return `${fmtDate.format(d)} ${fmtTime.format(d)}`
}

let me, profile
window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return }
    me=user; await loadProfile(); bindForm(); await loadLeaves()
  })
}
async function loadProfile(){
  const snap=await getDoc(doc(db,'users',me.uid))
  profile = snap.data()||{}; document.getElementById('profile').innerHTML = `${profile.nickname||profile.name||me.email}`
  renderQuota()
}
function renderQuota(){
  const year = new Date().getFullYear()
  const p = profile.annualLeavePolicy || {}
  const s = profile.leaveStats?.year === year ? profile.leaveStats : { approvedTaken: 0 }
  const eff = p.effectiveFrom ? new Date(p.effectiveFrom+'T00:00:00') : null
  const now = new Date()
  const quota = (eff && now<eff) ? 0 : (Number(p.baseDays||0)+Number(p.carryOverDays||0)+Number(p.manualAdjust||0))
  const used = Number(s.approvedTaken||0); const left=Math.max(0, quota-used)
  document.getElementById('quotaLeft').textContent=left
  document.getElementById('quotaTotal').textContent=quota
  document.getElementById('quotaUsed').textContent=used
}
function daysBetween(a,b){ const d1=new Date(a+'T00:00:00'), d2=new Date(b+'T00:00:00'); if(isNaN(d1)||isNaN(d2)) return 0; return Math.floor((d2-d1)/86400000)+1 }
function bindForm(){
  document.getElementById('submit').onclick = async () => {
    const start=document.getElementById('start').value, end=document.getElementById('end').value
    if(!start||!end) return alert('請選擇開始與結束日期'); if(end<start) return alert('結束日期不得早於開始日期')
    const days=daysBetween(start,end)
    await addDoc(collection(db,'users',me.uid,'leaves'), {
      type:'annual', start, end, days,
      status:'pending',
      createdAt: serverTimestamp(),
      createdAtTPE: nowTPE()
    })
    alert('已送出，等待主管核准'); document.getElementById('start').value=''; document.getElementById('end').value=''; await loadLeaves()
  }
}
async function loadLeaves(){
  const snap=await getDocs(collection(db,'users',me.uid,'leaves'))
  const list=document.getElementById('list'); if(snap.empty){ list.innerHTML='<div class="row">尚無申請</div>'; return }
  const rows=[]; snap.forEach(d=>{
    const l=d.data()
    const statusCN = l.status==='approved'?'已核准': l.status==='rejected'?'已拒絕':'待審核'
    rows.push(`<div class="row"><span>${l.start} ~ ${l.end}</span><span>${l.days||'-'}</span><span><span class="badge ${l.status}">${statusCN}</span></span></div>`)
  })
  list.innerHTML=rows.join('')
}
