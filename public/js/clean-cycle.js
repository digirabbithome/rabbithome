// clean-cycle.js — v1.4.2 Firestore + stacked contribution single-thin bar + monthly + admin delete only
import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  query, orderBy, onSnapshot, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const COL_TASKS = 'cleanCycleTasks'
const COL_HISTORY = 'cleanCycleHistory'
const ADMIN_EMAILS = new Set(['swimming8250@yahoo.com.tw','duckskin71@yahoo.com.tw'])

function nowIso(){ return new Date().toISOString(); }
function toDateLabel(iso){ if(!iso) return '—'; const d=new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
function addDays(iso,d){ const dt=new Date(iso||nowIso()); dt.setDate(dt.getDate()+d); return dt.toISOString() }
function daysBetween(aIso,bIso){ const A=new Date(aIso),B=new Date(bIso); return Math.floor((B-A)/86400000) }
function clampInt(v,min,max){ v=parseInt(v||0,10); if(isNaN(v)) v=min; return Math.max(min,Math.min(max,v)) }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])) }

let me=null, myNickname='', tasks=[], currentFilter='all', editingId=null, chart=null, historyCache=[], isAdmin=false

async function resolveNickname(uid){
  try{ const ref=doc(db,'users',uid); const snap=await getDoc(ref); if(snap.exists() && snap.data().nickname) return snap.data().nickname }catch(e){ console.warn('暱稱讀取失敗',e) }
  const email=auth.currentUser?.email||''; return email.includes('@')?email.split('@')[0]:'未填暱稱'
}

function watchTasks(){
  const qy=query(collection(db,COL_TASKS), orderBy('area'), orderBy('name'))
  return onSnapshot(qy, snap=>{ tasks = snap.docs.map(d=>({ ...d.data(), id:d.id })); renderList() })
}
function watchHistory(){
  const qy=query(collection(db,COL_HISTORY), orderBy('doneAtTS','desc'))
  return onSnapshot(qy, snap=>{ historyCache = snap.docs.map(d=>({ id:d.id, ...d.data() })); renderContribChart() })
}

async function addTask(data){ await addDoc(collection(db,COL_TASKS), { ...data, createdAt: serverTimestamp(), createdBy: me?.uid||null }) }
async function updateTask(id,patch){ await updateDoc(doc(db,COL_TASKS,id), patch) }
async function removeTask(id){ await deleteDoc(doc(db,COL_TASKS,id)) }
async function pushHistory(rec){ await addDoc(collection(db,COL_HISTORY), { ...rec, doneAt: nowIso(), doneAtTS: serverTimestamp() }) }

window.onload = ()=>{
  onAuthStateChanged(auth, async (user)=>{
    if(!user){ alert('請先登入 Rabbithome'); return }
    me=user; myNickname=await resolveNickname(user.uid); isAdmin = ADMIN_EMAILS.has(user.email||'')
    const nickEl=document.getElementById('nickname'); if(nickEl){ nickEl.value=myNickname; nickEl.disabled=true; nickEl.title='暱稱由帳號帶出' }
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
  document.getElementById('resetContrib')?.addEventListener('click', ()=> alert('雲端版不提供清空貢獻度（避免誤刪歷史）'))
  document.getElementById('saveTask')?.addEventListener('click', async ev=>{ ev.preventDefault(); await submitTaskDialog() })
}

function getStatus(task){
  const cycle=clampInt(task.days,1,3650); const dueAt=addDays(task.last||nowIso(),cycle); const d=daysBetween(nowIso(), dueAt);
  let status='ok'; if(d<=2&&d>0) status='soon'; if(d<=0) status=(d===0)?'due':'over'; return { status, daysLeft:d, dueAt }
}
function matchFilter(status, task){
  if(currentFilter==='all')return true
  if(currentFilter==='ok')return status==='ok'
  if(currentFilter==='soon')return status==='soon'
  if(currentFilter==='due')return status==='due'
  if(currentFilter==='overdue')return status==='over'
  if(currentFilter==='done-today'){ const today=(new Date()).toDateString(); return new Date(task.last).toDateString()===today }
  return true
}
function pillHtml(status, daysLeft){
  const label=(status==='ok'?'安全':status==='soon'?'即將到期':status==='due'?'到期':'逾期')
  let tip=''; if(status==='ok'||status==='soon') tip=`剩 ${daysLeft} 天`; else if(status==='due') tip='今天'; else tip=`逾期 ${Math.abs(daysLeft)} 天`
  return `<span class="pill ${status}">${label}</span><div class="meta">${tip}</div>`
}

function rowEl({head=false, task=null, st=null}){
  const div=document.createElement('div'); div.className='card'
  const row=document.createElement('div'); row.className='row '+(head?'head':'')
  if(head){ row.innerHTML=`
      <div>區域</div>
      <div>項目</div>
      <div>週期(天)</div>
      <div>下次到期</div>
      <div>狀態</div>
      <div>上次完成 / 備註 / 操作</div>`; div.appendChild(row); return div }
  const statusPill=pillHtml(st.status, st.daysLeft)
  row.innerHTML=`
    <div class="area">${escapeHtml(task.area||'—')}</div>
    <div>${escapeHtml(task.name||'—')}</div>
    <div>${clampInt(task.days,1,3650)}</div>
    <div><div>${toDateLabel(st.dueAt)}</div><div class="meta">每 ${clampInt(task.days,1,3650)} 天</div></div>
    <div>${statusPill}</div>
    <div>
      <div class="meta">上次 ${toDateLabel(task.last)}</div>
      <div class="meta">${escapeHtml(task.note||'')}</div>
      <div class="actions">
        <button class="btn small" data-act="done">✅ 完成一次</button>
        <button class="btn ghost small" data-act="edit">✏️ 編輯</button>
        ${isAdmin ? '<button class="btn ghost small" data-act="del">🗑️ 刪除</button>' : ''}
      </div>
    </div>`
  row.querySelector('[data-act="done"]').addEventListener('click', ()=> completeOne(task.id))
  row.querySelector('[data-act="edit"]').addEventListener('click', ()=> openEditDialog(task.id))
  const delBtn=row.querySelector('[data-act="del"]'); if(delBtn) delBtn.addEventListener('click', ()=> removeTaskConfirm(task.id))
  div.appendChild(row); return div
}

function renderList(){
  const container=document.getElementById('list'); container.innerHTML=''; container.appendChild(rowEl({head:true}))
  let due=0,over=0,doneToday=0; const today=(new Date()).toDateString()
  tasks.forEach(task=>{
    const st=getStatus(task); if(!matchFilter(st.status,task)) return
    if(st.status==='due') due++; if(st.status==='over') over++; if(new Date(task.last).toDateString()===today) doneToday++
    container.appendChild(rowEl({task,st}))
  })
  document.getElementById('totalCount').textContent=tasks.length
  document.getElementById('dueCount').textContent=due
  document.getElementById('overCount').textContent=over
  document.getElementById('doneToday').textContent=doneToday
}

async function completeOne(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  await updateTask(id,{ last: nowIso() })
  await pushHistory({ taskId:id, area:t.area, name:t.name, days:t.days, note:t.note||'', doneBy: myNickname, doneByUid: me?.uid||null })
}
async function removeTaskConfirm(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  if(!confirm(`確定刪除「${t.area}-${t.name}」？`)) return
  await removeTask(id)
}

async function completeAllDue(){
  let changed=0
  for(const t of tasks){
    const st=getStatus(t)
    if(st.status==='due'||st.status==='over'){
      await updateTask(t.id,{ last: nowIso() })
      await pushHistory({ taskId:t.id, area:t.area, name:t.name, days:t.days, note:t.note||'', doneBy: myNickname, doneByUid: me?.uid||null, action:'bulk-complete' })
      changed++
    }
  }
  if(!changed) alert('目前沒有到期/逾期項目。')
}

function openAddDialog(){
  editingId=null
  document.getElementById('dlgTitle').textContent='新增項目'
  document.getElementById('fArea').value=''
  document.getElementById('fName').value=''
  document.getElementById('fDays').value=7
  document.getElementById('fLast').value=''
  document.getElementById('fNote').value=''
  document.getElementById('taskDlg').showModal()
}
function openEditDialog(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  editingId=id
  document.getElementById('dlgTitle').textContent='編輯項目'
  document.getElementById('fArea').value=t.area||''
  document.getElementById('fName').value=t.name||''
  document.getElementById('fDays').value=clampInt(t.days,1,3650)
  const dt=new Date(t.last||nowIso()); document.getElementById('fLast').value=dt.toISOString().slice(0,16)
  document.getElementById('fNote').value=t.note||''
  document.getElementById('taskDlg').showModal()
}
async function submitTaskDialog(){
  const area=document.getElementById('fArea').value.trim()
  const name=document.getElementById('fName').value.trim()
  const days=clampInt(document.getElementById('fDays').value,1,3650)
  const lastInput=document.getElementById('fLast').value
  const last=lastInput?new Date(lastInput).toISOString():nowIso()
  const note=document.getElementById('fNote').value.trim()
  if(!area||!name){ alert('請輸入「區域」與「項目名稱」'); return }
  if(editingId){ await updateTask(editingId,{ area,name,days,last,note }) } else { await addTask({ area,name,days,last,note }) }
  document.getElementById('taskDlg').close()
}

function exportCSV(){
  const rows=[['區域','項目','週期(天)','上次完成ISO','備註','下次到期ISO','狀態']]
  tasks.forEach(t=>{ const st=getStatus(t); rows.push([t.area,t.name,t.days,t.last,t.note||'',st.dueAt,st.status]) })
  const csv=rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='clean-cycle-tasks.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

// ---- 單一細長堆疊條：每月 1 號起算 ----
function renderContribChart(){
  const cv=document.getElementById('contribChart'); if(!cv) return

  // 每月 1 號 00:00 ～ 次月 1 號 00:00
  const now=new Date()
  const monthStart=new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart=new Date(now.getFullYear(), now.getMonth()+1, 1)

  const lab=document.getElementById('chartMonthLabel')
  if(lab){ lab.textContent = `本月 (${monthStart.getFullYear()}-${String(monthStart.getMonth()+1).padStart(2,'0')})` }

  const counts={}
  for(const r of historyCache){
    const t = r.doneAt ? new Date(r.doneAt) : null
    if(!t || t < monthStart || t >= nextMonthStart) continue
    const key=(r.doneBy||'未填暱稱').trim()||'未填暱稱'
    counts[key]=(counts[key]||0)+1
  }
  const names=Object.keys(counts)
  const values=names.map(k=>counts[k])
  const sum=values.reduce((a,b)=>a+b,0)
  const safeNames = names.length ? names : ['—']
  const safeCounts = names.length ? values : [0]
  const percents = names.length && sum>0 ? values.map(v=>Math.round(v/sum*1000)/10) : [0]

  if(chart){ chart.destroy(); chart=null }

  chart = new Chart(cv, {
    type:'bar',
    data:{ labels:[''], datasets: safeNames.map((n,i)=>({ label:n, data:[percents[i]], borderWidth:1 })) },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:false,
      indexAxis:'y',
      plugins:{
        legend:{ position:'top' },
        tooltip:{ callbacks:{ label:(c)=>`${c.dataset.label}: ${c.raw}%（${safeCounts[c.dataIndex] || safeCounts[0]} 次）` } }
      },
      scales:{
        x:{ stacked:true, min:0, max:100, ticks:{ callback:v=>v+'%' } },
        y:{ stacked:true, ticks:{ display:false }, grid:{ display:false } }
      }
    }
  })
}
