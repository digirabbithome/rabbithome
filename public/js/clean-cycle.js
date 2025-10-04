// v1.7.0 - robust daily work append (arrayUnion + fallback 'workItems')
import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, getDoc, arrayUnion,
  query, orderBy, onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const COL_TASKS = 'cleanCycleTasks'
const COL_HISTORY = 'cleanCycleHistory'
const COL_DAILY = 'dailyWork'    // 聚合：每天每人 1 份，tasks 為陣列
const COL_WORKITEMS = 'workItems' // 後援：逐行新增一筆
const ADMIN_EMAILS = new Set(['swimming8250@yahoo.com.tw','duckskin71@yahoo.com.tw'])

function nowIso(){ return new Date().toISOString(); }
function toDateOnly(iso){ if(!iso) return '—'; const d=new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function toDateSlash(iso){ if(!iso) return '—'; const d=new Date(iso); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }
function addDays(iso,d){ const dt=new Date(iso||nowIso()); dt.setDate(dt.getDate()+d); return dt.toISOString() }
function daysBetween(aIso,bIso){ const A=new Date(aIso),B=new Date(bIso); return Math.floor((B-A)/86400000) }
function clampInt(v,min,max){ v=parseInt(v||0,10); if(isNaN(v)) v=min; return Math.max(min,Math.min(max,v)) }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])) }

let me=null, myNickname='', tasks=[], currentFilter='all', editingId=null, historyCache=[], isAdmin=false
let chart=null

// ---------- UI handlers ----------
function openAddDialog(){
  editingId=null
  document.getElementById('dlgTitle').textContent='新增項目'
  document.getElementById('fArea').value=''
  document.getElementById('fName').value=''
  document.getElementById('fDays').value=7
  document.getElementById('fNote').value=''
  document.getElementById('editOnlySlot').innerHTML=''
  document.getElementById('taskDlg').showModal()
}
function openEditDialog(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  editingId=id
  document.getElementById('dlgTitle').textContent='編輯項目'
  document.getElementById('fArea').value=t.area||''
  document.getElementById('fName').value=t.name||''
  document.getElementById('fDays').value=clampInt(t.days,1,3650)
  document.getElementById('fNote').value=t.note||''
  const slot=document.getElementById('editOnlySlot')
  slot.innerHTML=`<label>上次完成
    <input id="fLast" type="datetime-local" />
  </label>`
  const dt=new Date(t.last||nowIso()); document.getElementById('fLast').value=dt.toISOString().slice(0,16)
  document.getElementById('taskDlg').showModal()
}
async function submitTaskDialog(){
  const area=document.getElementById('fArea').value.trim()
  const name=document.getElementById('fName').value.trim()
  const days=clampInt(document.getElementById('fDays').value,1,3650)
  const note=document.getElementById('fNote').value.trim()
  if(!area||!name){ alert('請輸入「區域」與「項目名稱」'); return }
  if(editingId){
    const lastEl=document.getElementById('fLast')
    const last=lastEl?new Date(lastEl.value).toISOString():nowIso()
    await updateTask(editingId,{ area,name,days,last,note })
  }else{
    await addTask({ area,name,days,note })
  }
  document.getElementById('taskDlg').close()
}
async function completeOne(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  await updateTask(id,{ last: nowIso() })
  await pushHistory({ taskId:id, area:t.area, name:t.name, days:t.days, note:t.note||'', doneBy: myNickname, doneByUid: me?.uid||null })
  await appendDailyWork(myNickname, t.area, t.name)
}

// ---------- core helpers ----------
async function resolveNickname(uid){
  // 先到 users/{uid} 取 nickname；無則用 email 前段
  try{
    const ref=doc(db,'users',uid);
    const snap=await getDoc(ref);
    if(snap.exists() && snap.data().nickname) return snap.data().nickname;
  }catch(e){ console.warn('resolveNickname users error', e); }
  const email=auth.currentUser?.email||''; return email.includes('@')?email.split('@')[0]:'未填暱稱'
}
async function addTask(data){ await addDoc(collection(db,COL_TASKS), { ...data, createdAt: serverTimestamp(), createdBy: me?.uid||null }) }
async function updateTask(id,patch){ await updateDoc(doc(db,COL_TASKS,id), patch) }
async function pushHistory(rec){ await addDoc(collection(db,COL_HISTORY), { ...rec, doneAt: nowIso(), doneAtTS: serverTimestamp() }) }

// 這裡同時寫入：
// 1) dailyWork（每天每人一份，以 tasks 陣列 arrayUnion 追加）
// 2) workItems（每次一筆獨立文件，避免與既有系統 schema 不同步）
async function appendDailyWork(nick, area, name){
  const now=new Date(); const dateStr=now.toISOString().slice(0,10); const timeStr=now.toTimeString().slice(0,5)
  const line=`${timeStr} 完成 ${area}${name}`
  // 1) 聚合：dailyWork
  try{
    const id=`${dateStr.replace(/-/g,'')}_${nick}`
    const ref=doc(db,COL_DAILY,id)
    await setDoc(ref,{date:dateStr,nickname:nick,updatedAt:serverTimestamp()}, {merge:true})
    await updateDoc(ref,{tasks: arrayUnion(line)})
    console.log('[dailyWork] appended', id, line)
  }catch(e){ console.warn('[dailyWork] append failed', e) }
  // 2) 後援：workItems
  try{
    await addDoc(collection(db,COL_WORKITEMS), {date:dateStr,nickname:nick,content:line,createdAt:serverTimestamp(),source:'clean-cycle'})
    console.log('[workItems] added', line)
  }catch(e){ console.warn('[workItems] add failed', e) }
}

// ---------- view renderers ----------
function toDateLabel(iso){ return toDateSlash(iso) }
function getStatus(task){
  const cycle=clampInt(task.days,1,3650);
  if(!task.last){
    const dueAt = addDays(nowIso(), cycle)
    const d = daysBetween(nowIso(), dueAt)
    return { status:'new', daysLeft:d, dueAt }
  }
  const dueAt=addDays(task.last,cycle); 
  const d=daysBetween(nowIso(), dueAt);
  let status='ok'; if(d<=2&&d>0) status='soon'; if(d<=0) status=(d===0)?'due':'over'; 
  return { status, daysLeft:d, dueAt }
}
function statusBucket(status){
  if(status==='new') return 'wait'
  if(status==='due'||status==='over') return 'need'
  if(status==='soon') return 'wait'
  return 'done'
}
function rowEl({head=false, task=null, st=null, bucket=null}){
  const div=document.createElement('div'); 
  div.className='card ' + (bucket==='need'?'need-bg':bucket==='wait'?'wait-bg':'done-bg')
  const row=document.createElement('div'); row.className='row '+(head?'head':'')
  if(head){ row.innerHTML=`<div>區域</div><div>項目</div><div>狀態</div><div>上次完成 / 下次清潔（剩餘） / 備註</div><div>操作</div>`; div.appendChild(row); return div }
  const pillText = st.status==='new' ? '尚未清潔' : (bucket==='need'?'需要清潔':bucket==='wait'?'等待清潔':'完成清潔')
  const pillClass = st.status==='new' ? 'new' : bucket
  const pill = `<span class="pill ${pillClass}">${pillText}</span>`
  const nextStr = `${toDateSlash(st.dueAt)}（剩 ${st.daysLeft} 天）`
  row.innerHTML=`
    <div class="area">${escapeHtml(task.area||'—')}</div>
    <div>${escapeHtml(task.name||'—')}</div>
    <div>${pill}</div>
    <div><div class="meta">上次 ${toDateOnly(task.last)} ／ ${nextStr}</div><div class="meta note-line">${escapeHtml(task.note||'')}</div></div>
    <div class="actions-col"><button class="btn small" data-act="done">🧽 清潔完成</button><button class="btn ghost small" data-act="edit">✏️ 編輯</button>${isAdmin ? '<button class="btn ghost small" data-act="del">🗑️ 刪除</button>' : ''}</div>`
  row.querySelector('[data-act="done"]').addEventListener('click', ()=> completeOne(task.id))
  row.querySelector('[data-act="edit"]').addEventListener('click', ()=> openEditDialog(task.id))
  const delBtn=row.querySelector('[data-act="del"]'); if(delBtn) delBtn.addEventListener('click', ()=> removeTaskConfirm(task.id))
  div.appendChild(row); return div
}
function renderList(){
  const container=document.getElementById('list'); if(!container) return;
  container.innerHTML=''; container.appendChild(rowEl({head:true}))
  let need=0,wait=0,doneToday=0; const today=(new Date()).toDateString()
  const withStatus = tasks.map(t=>{ const st=getStatus(t); return { t, st, bucket: statusBucket(st.status) } })
  withStatus.sort((a,b)=>({need:0,wait:1,done:2}[a.bucket]-({need:0,wait:1,done:2}[b.bucket])))
  withStatus.forEach(({t,st,bucket})=>{
    if(bucket==='need') need++; else if(bucket==='wait') wait++;
    if(new Date(t.last||0).toDateString()===today) doneToday++;
    if(currentFilter==='all'
      || (['overdue','due'].includes(currentFilter) && bucket==='need')
      || (currentFilter==='soon' && bucket==='wait')
      || (currentFilter==='ok' && bucket==='done')
      || (currentFilter==='done-today' && new Date(t.last||0).toDateString()===today)){
      container.appendChild(rowEl({task:t, st, bucket}))
    }
  })
  const el=(id,v)=>{ const x=document.getElementById(id); if(x) x.textContent=v }
  el('totalCount', tasks.length); el('dueCount', wait); el('overCount', need); el('doneToday', doneToday)
}

// Doughnut chart
let chart=null
function renderContribDonut(){
  const cv=document.getElementById('contribChart'); if(!cv) return
  const now=new Date(), m0=new Date(now.getFullYear(), now.getMonth(), 1), m1=new Date(now.getFullYear(), now.getMonth()+1, 1)
  const lab=document.getElementById('chartMonthLabel'); if(lab){ lab.textContent=`本月 (${m0.getFullYear()}-${String(m0.getMonth()+1).padStart(2,'0')})` }
  const counts={}; for(const r of historyCache){ const t=r.doneAt?new Date(r.doneAt):null; if(!t||t<m0||t>=m1) continue; const k=(r.doneBy||'未填暱稱').trim()||'未填暱稱'; counts[k]=(counts[k]||0)+1 }
  const names=Object.keys(counts), values=names.map(k=>counts[k]), sum=values.reduce((a,b)=>a+b,0)
  const center=document.getElementById('donutCenterText'); if(center) center.textContent=`本月完成 ${sum} 次`
  if(chart){ chart.destroy(); chart=null }
  if(names.length===0){ chart=new Chart(cv,{type:'doughnut',data:{labels:['尚無紀錄'],datasets:[{data:[1],backgroundColor:['#e5e7eb'],borderWidth:0}]},options:{cutout:'65%',plugins:{legend:{display:false}}}}); if(center) center.textContent='本月完成 0 次'; return }
  const ctx=cv.getContext('2d'), palette=[['#fbd5e6','#f472b6'],['#c7d2fe','#93c5fd'],['#e9d5ff','#c4b5fd'],['#bbf7d0','#86efac']]
  const backgrounds=names.map((_,i)=>{ const [a,b]=palette[i%palette.length]; const g=ctx.createLinearGradient(0,0,300,300); g.addColorStop(0,a); g.addColorStop(1,b); return g })
  chart=new Chart(cv,{type:'doughnut',data:{labels:names,datasets:[{data:values,backgroundColor:backgrounds,borderWidth:1,hoverOffset:4}]},options:{cutout:'65%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.label}: ${c.parsed} 次 (${Math.round(c.parsed/sum*1000)/10}%)`}}}}})
}

// ---------- subscriptions & init ----------
function watchTasks(){
  const qy=query(collection(db,COL_TASKS), orderBy('area'), orderBy('name'))
  return onSnapshot(qy, snap=>{ tasks = snap.docs.map(d=>({ ...d.data(), id:d.id })); renderList() })
}
function watchHistory(){
  const qy=query(collection(db,COL_HISTORY), orderBy('doneAtTS','desc'))
  return onSnapshot(qy, snap=>{ historyCache = snap.docs.map(d=>({ id:d.id, ...d.data() })); renderContribDonut() })
}
function bindUI(){
  document.querySelectorAll('.filters .chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.filters .chip').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active'); currentFilter=btn.dataset.filter; renderList()
    })
  })
  document.getElementById('openAdd')?.addEventListener('click', openAddDialog)
  document.getElementById('checkAllDue')?.addEventListener('click', completeAllDue)
  document.getElementById('exportCSV')?.addEventListener('click', exportCSV)
  document.getElementById('saveTask')?.addEventListener('click', async ev=>{ ev.preventDefault(); await submitTaskDialog() })
}
function exportCSV(){
  const rows=[['區域','項目','週期(天)','上次完成ISO','備註','清潔時間ISO','狀態']]
  tasks.forEach(t=>{ const st=getStatus(t); const bucket=statusBucket(st.status); rows.push([t.area,t.name,t.days,t.last||'',t.note||'',st.dueAt,bucket]) })
  const csv=rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='clean-cycle-tasks.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

window.onload = ()=>{
  onAuthStateChanged(auth, async (user)=>{
    if(!user){ alert('請先登入 Rabbithome'); return }
    me=user; myNickname=await resolveNickname(user.uid); isAdmin = ADMIN_EMAILS.has(user.email||'')
    const nickEl=document.getElementById('nickname'); if(nickEl){ nickEl.value=myNickname; nickEl.disabled=true }
    bindUI(); watchTasks(); watchHistory();
  })
}
