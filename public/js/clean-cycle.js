// v1.6.5 - fix chart var & state backgrounds
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
function toDateOnly(iso){ if(!iso) return '—'; const d=new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function toDateSlash(iso){ if(!iso) return '—'; const d=new Date(iso); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }
function addDays(iso,d){ const dt=new Date(iso||nowIso()); dt.setDate(dt.getDate()+d); return dt.toISOString() }
function daysBetween(aIso,bIso){ const A=new Date(aIso),B=new Date(bIso); return Math.floor((B-A)/86400000) }
function clampInt(v,min,max){ v=parseInt(v||0,10); if(isNaN(v)) v=min; return Math.max(min,Math.min(max,v)) }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])) }

let me=null, myNickname='', tasks=[], currentFilter='all', editingId=null, historyCache=[], isAdmin=false
let chart=null  // single global chart variable

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
  document.getElementById('saveTask')?.addEventListener('click', async ev=>{ ev.preventDefault(); await submitTaskDialog() })
}

function getStatus(task){
  const cycle=clampInt(task.days,1,3650);
  const base = task.last || nowIso();
  const dueAt=addDays(base,cycle); 
  const d=daysBetween(nowIso(), dueAt);
  let status='ok'; if(d<=2&&d>0) status='soon'; if(d<=0) status=(d===0)?'due':'over'; 
  return { status, daysLeft:d, dueAt }
}
function statusBucket(status){
  if(status==='due'||status==='over') return 'need'
  if(status==='soon') return 'wait'
  return 'done'
}

function rowEl({head=false, task=null, st=null, bucket=null}){
  const div=document.createElement('div'); 
  div.className='card ' + (bucket==='need'?'need-bg':bucket==='wait'?'wait-bg':'done-bg')
  const row=document.createElement('div'); row.className='row '+(head?'head':'')
  if(head){ row.innerHTML=`
      <div>區域</div>
      <div>項目</div>
      <div>狀態</div>
      <div>上次完成 / 下次清潔（剩餘） / 備註 / 操作</div>`; div.appendChild(row); return div }
  const pill = `<span class="pill ${bucket}">${bucket==='need'?'需要清潔':bucket==='wait'?'等待清潔':'完成清潔'}</span>`
  const nextStr = `${toDateSlash(st.dueAt)}（剩 ${st.daysLeft} 天）`
  row.innerHTML=`
    <div class="area">${escapeHtml(task.area||'—')}</div>
    <div>${escapeHtml(task.name||'—')}</div>
    <div>${pill}</div>
    <div>
      <div class="meta with-actions">
        <span>上次 ${toDateOnly(task.last)} ／ 下次清潔 ${nextStr}</span>
        <span class="actions-inline">
          <button class="btn small" data-act="done">🧽 清潔完成</button>
          <button class="btn ghost small" data-act="edit">✏️ 編輯</button>
          ${isAdmin ? '<button class="btn ghost small" data-act="del">🗑️ 刪除</button>' : ''}
        </span>
      </div>
      <div class="meta note-line">${escapeHtml(task.note||'')}</div>
    </div>`
  row.querySelector('[data-act="done"]').addEventListener('click', ()=> completeOne(task.id))
  row.querySelector('[data-act="edit"]').addEventListener('click', ()=> openEditDialog(task.id))
  const delBtn=row.querySelector('[data-act="del"]'); if(delBtn) delBtn.addEventListener('click', ()=> removeTaskConfirm(task.id))
  div.appendChild(row); return div
}

function renderList(){
  const container=document.getElementById('list'); container.innerHTML=''; container.appendChild(rowEl({head:true}))
  let need=0,wait=0,doneToday=0; const today=(new Date()).toDateString()
  const withStatus = tasks.map(t=>{ const st=getStatus(t); return { t, st, bucket: statusBucket(st.status) } })
  withStatus.sort((a,b)=>({need:0,wait:1,done:2}[a.bucket]-({need:0,wait:1,done:2}[b.bucket])))
  withStatus.forEach(({t,st,bucket})=>{
    if(bucket==='need') need++; else if(bucket==='wait') wait++;
    if(new Date(t.last||0).toDateString()===today) doneToday++;
    if(
      currentFilter==='all' ||
      (['overdue','due'].includes(currentFilter) && bucket==='need') ||
      (currentFilter==='soon' && bucket==='wait') ||
      (currentFilter==='ok' && bucket==='done') ||
      (currentFilter==='done-today' && new Date(t.last||0).toDateString()===today)
    ){
      container.appendChild(rowEl({task:t, st, bucket}))
    }
  })
  document.getElementById('totalCount').textContent=tasks.length
  document.getElementById('dueCount').textContent=wait
  document.getElementById('overCount').textContent=need
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
  if(!changed) alert('目前沒有需要清潔的項目。')
}

function openAddDialog(){
  editingId=null
  document.getElementById('dlgTitle').textContent='新增項目'
  document.getElementById('fArea').value=''
  document.getElementById('fName').value=''
  document.getElementById('fDays').value=7
  document.getElementById('fLast').value=''
  document.getElementById('fNote').value=''
  const wrap=document.getElementById('lastWrap'); wrap.style.display='none'
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
  const wrap=document.getElementById('lastWrap'); wrap.style.display='block'
  document.getElementById('taskDlg').showModal()
}
async function submitTaskDialog(){
  const area=document.getElementById('fArea').value.trim()
  const name=document.getElementById('fName').value.trim()
  const days=clampInt(document.getElementById('fDays').value,1,3650)
  const note=document.getElementById('fNote').value.trim()
  if(!area||!name){ alert('請輸入「區域」與「項目名稱」'); return }
  if(editingId){
    const lastInput=document.getElementById('fLast').value
    const last=lastInput?new Date(lastInput).toISOString():nowIso()
    await updateTask(editingId,{ area,name,days,last,note })
  }else{
    await addTask({ area,name,days,note })
  }
  document.getElementById('taskDlg').close()
}

function exportCSV(){
  const rows=[['區域','項目','週期(天)','上次完成ISO','備註','清潔時間ISO','狀態']]
  tasks.forEach(t=>{ const st=getStatus(t); const bucket=statusBucket(st.status); rows.push([t.area,t.name,t.days,t.last||'',t.note||'',st.dueAt,bucket]) })
  const csv=rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='clean-cycle-tasks.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

// ---- Doughnut 貢獻圖（每月） ----
function renderContribDonut(){
  const cv=document.getElementById('contribChart'); if(!cv) return
  const now=new Date(), m0=new Date(now.getFullYear(), now.getMonth(), 1), m1=new Date(now.getFullYear(), now.getMonth()+1, 1)
  const lab=document.getElementById('chartMonthLabel'); if(lab){ lab.textContent=`本月 (${m0.getFullYear()}-${String(m0.getMonth()+1).padStart(2,'0')})` }
  const counts={}; for(const r of historyCache){ const t=r.doneAt?new Date(r.doneAt):null; if(!t||t<m0||t>=m1) continue; const k=(r.doneBy||'未填暱稱').trim()||'未填暱稱'; counts[k]=(counts[k]||0)+1 }
  const names=Object.keys(counts), values=names.map(k=>counts[k]), sum=values.reduce((a,b)=>a+b,0)
  const center=document.getElementById('donutCenterText'); center.textContent=`本月完成 ${sum} 次`
  if(chart){ chart.destroy(); chart=null }
  if(names.length===0){ chart=new Chart(cv,{type:'doughnut',data:{labels:['尚無紀錄'],datasets:[{data:[1],backgroundColor:['#e5e7eb'],borderWidth:0}]},options:{cutout:'65%',plugins:{legend:{display:false}}}}); center.textContent='本月完成 0 次'; return }
  const ctx=cv.getContext('2d'), palette=[['#fbd5e6','#f472b6'],['#c7d2fe','#93c5fd'],['#e9d5ff','#c4b5fd'],['#bbf7d0','#86efac']]
  const backgrounds=names.map((_,i)=>{ const [a,b]=palette[i%palette.length]; const g=ctx.createLinearGradient(0,0,300,300); g.addColorStop(0,a); g.addColorStop(1,b); return g })
  chart=new Chart(cv,{type:'doughnut',data:{labels:names,datasets:[{data:values,backgroundColor:backgrounds,borderWidth:1,hoverOffset:4}]},options:{cutout:'65%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.label}: ${c.parsed} 次 (${Math.round(c.parsed/sum*1000)/10}%)`}}}}})
}
