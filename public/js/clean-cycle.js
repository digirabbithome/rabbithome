// v1.6.8 - auto append to dailyWork when cleaning done
import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, getDoc,
  query, orderBy, onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const COL_TASKS = 'cleanCycleTasks'
const COL_HISTORY = 'cleanCycleHistory'
const COL_DAILY = 'dailyWork'
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

async function resolveNickname(uid){
  try{ const ref=doc(db,'users',uid); const snap=await getDoc(ref); if(snap.exists() && snap.data().nickname) return snap.data().nickname }catch(e){}
  const email=auth.currentUser?.email||''; return email.includes('@')?email.split('@')[0]:'未填暱稱'
}

function watchTasks(){
  const qy=query(collection(db,COL_TASKS), orderBy('area'), orderBy('name'))
  return onSnapshot(qy, snap=>{ tasks = snap.docs.map(d=>({ ...d.data(), id:d.id })); renderList() })
}
function watchHistory(){
  const qy=query(collection(db,COL_HISTORY), orderBy('doneAtTS','desc'))
  return onSnapshot(qy, snap=>{ historyCache = snap.docs.map(d=>({ id:d.id, ...d.data() })); renderContribDonut() })
}

async function addTask(data){ await addDoc(collection(db,COL_TASKS), { ...data, createdAt: serverTimestamp(), createdBy: me?.uid||null }) }
async function updateTask(id,patch){ await updateDoc(doc(db,COL_TASKS,id), patch) }
async function removeTask(id){ await deleteDoc(doc(db,COL_TASKS,id)) }
async function pushHistory(rec){ await addDoc(collection(db,COL_HISTORY), { ...rec, doneAt: nowIso(), doneAtTS: serverTimestamp() }) }

async function appendDailyWork(nick, area, name){
  try{
    const now=new Date(); const dateStr=now.toISOString().slice(0,10); const timeStr=now.toTimeString().slice(0,5)
    const id=`${dateStr.replace(/-/g,'')}_${nick}`
    const ref=doc(db,COL_DAILY,id)
    const snap=await getDoc(ref)
    const line=`${timeStr} 完成 ${area}${name}`
    if(snap.exists()){
      const data=snap.data()
      const tasks=Array.isArray(data.tasks)?[...data.tasks,line]:[line]
      await updateDoc(ref,{tasks})
    }else{
      await setDoc(ref,{date:dateStr,nickname:nick,tasks:[line],createdAt:serverTimestamp()})
    }
  }catch(e){console.error('appendDailyWork error',e)}
}

window.onload = ()=>{
  onAuthStateChanged(auth, async (user)=>{
    if(!user){ alert('請先登入 Rabbithome'); return }
    me=user; myNickname=await resolveNickname(user.uid); isAdmin = ADMIN_EMAILS.has(user.email||'')
    const nickEl=document.getElementById('nickname'); if(nickEl){ nickEl.value=myNickname; nickEl.disabled=true }
    watchTasks(); watchHistory(); bindUI();
  })
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
  const container=document.getElementById('list'); container.innerHTML=''; container.appendChild(rowEl({head:true}))
  const today=(new Date()).toDateString()
  const withStatus = tasks.map(t=>{ const st=getStatus(t); return { t, st, bucket: statusBucket(st.status) } })
  withStatus.sort((a,b)=>({need:0,wait:1,done:2}[a.bucket]-({need:0,wait:1,done:2}[b.bucket])))
  withStatus.forEach(({t,st,bucket})=>{
    if(currentFilter==='all'||bucket===currentFilter) container.appendChild(rowEl({task:t, st, bucket}))
  })
}

async function completeOne(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  await updateTask(id,{ last: nowIso() })
  await pushHistory({ taskId:id, area:t.area, name:t.name, days:t.days, note:t.note||'', doneBy: myNickname, doneByUid: me?.uid||null })
  await appendDailyWork(myNickname, t.area, t.name)
}
