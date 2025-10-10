// v1.11.0 - hover shows last cleaner; admin "reclean" with note; keep original structure
import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, getDoc,
  query, orderBy, onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const COL_TASKS = 'cleanCycleTasks'
const COL_HISTORY = 'cleanCycleHistory'
const COL_WORKREPORTS = 'workReports'
const ADMIN_EMAILS = new Set(['swimming8250@yahoo.com.tw','duckskin71@yahoo.com.tw'])

function nowIso(){ return new Date().toISOString(); }
function toDateOnly(iso){ if(!iso) return '—'; const d=new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function toDateSlash(iso){ if(!iso) return '—'; const d=new Date(iso); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }
function addDays(iso,d){ const dt=new Date(iso||nowIso()); dt.setDate(dt.getDate()+d); return dt.toISOString() }
function daysBetween(aIso,bIso){ const A=new Date(aIso),B=new Date(bIso); return Math.floor((B-A)/86400000) }
function clampInt(v,min,max){ v=parseInt(v||0,10); if(isNaN(v)) v=min; return Math.max(min,Math.min(max,v)) }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])) }

// TPE-friendly short time: 10/09 下午 03:10
function fmtTpeShort(iso){
  if(!iso) return ''
  const d = new Date(iso)
  const m = String(d.getMonth()+1).padStart(2,'0')
  const da= String(d.getDate()).padStart(2,'0')
  const hh = d.getHours()
  const mm = String(d.getMinutes()).padStart(2,'0')
  const ap = hh >= 12 ? '下午' : '上午'
  const hh12 = String((hh%12)||12).padStart(2,'0')
  return `${m}/${da} ${ap} ${hh12}:${mm}`
}

let me=null, myNickname='', tasks=[], currentFilter='all', editingId=null, historyCache=[], isAdmin=false

// toast
function showToast(msg){
  const el=document.getElementById('toast'); if(!el) return;
  const text=document.getElementById('toastText'); if(text) text.textContent=msg;
  el.classList.add('show');
  setTimeout(()=>{ el.classList.remove('show') }, 2000);
}

// ---------- Firestore helpers ----------
async function resolveNickname(uid){
  try{ const ref=doc(db,'users',uid); const snap=await getDoc(ref); if(snap.exists() && snap.data().nickname) return snap.data().nickname }catch(e){}
  const email=auth.currentUser?.email||''; return email.includes('@')?email.split('@')[0]:'未填暱稱'
}
async function addTask(data){ await addDoc(collection(db,COL_TASKS), { ...data, createdAt: serverTimestamp(), createdBy: me?.uid||null }) }
async function updateTask(id,patch){ await updateDoc(doc(db,COL_TASKS,id), patch) }
async function pushHistory(rec){ await addDoc(collection(db,COL_HISTORY), { ...rec, doneAt: nowIso(), doneAtTS: serverTimestamp() }) }

// 寫入 workReports（以 `${uid}_${YYYY-MM-DD}` 為文件 ID；append plainText 與 contentHtml）
async function appendWorkReport(uid, email, nickname, area, name){
  try{
    const now=new Date(); const dateStr=now.toISOString().slice(0,10); const timeStr=now.toTimeString().slice(0,5); const monthKey=dateStr.slice(0,7);
    const id=`${uid}_${dateStr}`; const ref=doc(db,COL_WORKREPORTS,id);
    const line=`${timeStr} 完成 ${area}${name}`; const lineHtml=`<div>${line}</div>`;
    const snap=await getDoc(ref);
    if(snap.exists()){
      const d=snap.data()||{};
      const newPlain = (d.plainText? d.plainText + '\\n' : '') + line;
      const newHtml = (d.contentHtml? d.contentHtml + lineHtml : lineHtml);
      await updateDoc(ref,{ plainText:newPlain, contentHtml:newHtml, updatedAt:serverTimestamp() });
      console.log('[workReports] appended', id, line);
    }else{
      await setDoc(ref, { author:{email, nickname}, date:dateStr, monthKey, plainText:line, contentHtml:lineHtml, createdAt:serverTimestamp() });
      console.log('[workReports] created', id, line);
    }
    return true;
  }catch(e){ console.warn('[workReports] write failed', e); return false; }
}

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
  const lastText = t.last ? toDateSlash(t.last) : '—'
  slot.innerHTML = `<div class="meta">上次完成：${escapeHtml(lastText)}</div>`
  document.getElementById('taskDlg').showModal()
}
async function submitTaskDialog(){
  const area=document.getElementById('fArea').value.trim()
  const name=document.getElementById('fName').value.trim()
  const days=clampInt(document.getElementById('fDays').value,1,3650)
  const note=document.getElementById('fNote').value.trim()
  if(!area||!name){ alert('請輸入「區域」與「項目名稱」'); return }
  if(editingId){
    const patch = { area,name,days,note }
    const lastEl=document.getElementById('fLast')
    if(lastEl && lastEl.value){
      const original = tasks.find(x=>x.id===editingId)?.last || null
      const newVal = new Date(lastEl.value).toISOString()
      if(original !== newVal) patch.last = newVal
    }
    await updateTask(editingId, patch)
  }else{
    await addTask({ area,name,days,note })
  }
  document.getElementById('taskDlg').close()
}

// ✅ 清潔完成：同時清掉 reclean 提醒欄位（若有）
async function completeOne(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  await updateTask(id,{
    last: nowIso(),
    recleanNote: null,
    recleanBy: null,
    recleanByUid: null,
    recleanAt: null
  })
  await pushHistory({ taskId:id, area:t.area, name:t.name, days:t.days, note:t.note||'', doneBy: myNickname, doneByUid: me?.uid||null })
  const ok = await appendWorkReport(me?.uid||'unknown', auth.currentUser?.email||'', myNickname, t.area, t.name)
  if(ok) showToast('✅ 清潔完成，已同步至工作紀錄')
}

async function removeTaskConfirm(id){
  const t=tasks.find(x=>x.id===id); if(!t) return
  if(!confirm(`確定刪除「${t.area}-${t.name}」？`)) return
  await deleteDoc(doc(db,COL_TASKS,id))
}
async function completeAllDue(){
  let changed=0
  for(const t of tasks){
    const st=getStatus(t)
    if(st.status==='due'||st.status==='over'){
      await updateTask(t.id,{ last: nowIso(), recleanNote:null, recleanBy:null, recleanByUid:null, recleanAt:null })
      await pushHistory({ taskId:t.id, area:t.area, name:t.name, days:t.days, note:t.note||'', doneBy: myNickname, doneByUid: me?.uid||null, action:'bulk-complete' })
      await appendWorkReport(me?.uid||'unknown', auth.currentUser?.email||'', myNickname, t.area, t.name)
      changed++
    }
  }
  if(changed>0) showToast(`✅ 已完成並同步 ${changed} 筆`)
  else alert('目前沒有需要清潔的項目。')
}

// 🆕 管理者：重新清潔（打回為未清潔 + 可留言給下一位）
async function markReclean(id){
  if(!isAdmin){ showToast('只有管理者可操作'); return }
  const t=tasks.find(x=>x.id===id); if(!t) return
  const note = window.prompt('要留給下一位清潔的注意事項？（可留空）', t.recleanNote || '')
  await updateTask(id, {
    last: null, // 讓它回到「需要清潔」
    recleanNote: (note||'').trim() || null,
    recleanBy: myNickname,
    recleanByUid: me?.uid || null,
    recleanAt: nowIso(),
    recleanCount: (typeof t.recleanCount === 'number' ? t.recleanCount+1 : 1)
  })
  await pushHistory({ taskId:id, area:t.area, name:t.name, days:t.days, note:(note||'').trim()||'', doneBy: myNickname, doneByUid: me?.uid||null, action:'reclean' })
  showToast('🔁 已退回為「需要清潔」')
}

// ---------- view renderers ----------
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

// 🆕 從歷史找「最後一次完成」的人與時間（排除 reclean）
function lastCleanerFor(taskId){
  for(const r of historyCache){ // historyCache 已是降冪
    if(r.taskId===taskId && r.action!=='reclean'){
      return { by: r.doneBy || '—', at: r.doneAt || null }
    }
  }
  return null
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

  // 🆕 名稱加 hover 提示：最後完成者
  const last = lastCleanerFor(task.id)
  const nameTitle = last ? `${fmtTpeShort(last.at)} ${last.by} 清潔完成` : (task.last ? `${fmtTpeShort(task.last)} 清潔完成` : '尚無完成紀錄')
  const nameHtml = `<span class="task-name" title="${escapeHtml(nameTitle)}">${escapeHtml(task.name||'—')}</span>`

  // 🆕 注意事項徽章（若有 recleanNote）
  const noteBadge = task.recleanNote ? ` <span class="note-pill" title="${escapeHtml(task.recleanNote)}">注意事項</span>` : ''

  row.innerHTML=`
    <div class="area">${escapeHtml(task.area||'—')}</div>
    <div>${nameHtml}</div>
    <div>${pill}</div>
    <div>
      <div class="meta">上次 ${toDateOnly(task.last)} ／ ${nextStr}</div>
      <div class="meta note-line">${escapeHtml(task.note||'')}${noteBadge}</div>
    </div>
    <div class="actions-col">
      <button class="btn small" data-act="done">🧽 清潔完成</button>
      ${isAdmin ? `
        ${(bucket==='done' || task.last) ? `<button class="btn ghost small" data-act="reclean">🔁 重新清潔</button>` : ''}
        <button class="btn ghost small" data-act="edit">✏️ 編輯</button>
        <button class="btn ghost small" data-act="del">🗑️ 刪除</button>
      ` : ''}
    </div>`
  row.querySelector('[data-act="done"]').addEventListener('click', ()=> completeOne(task.id))
  const reBtn=row.querySelector('[data-act="reclean"]'); if(reBtn) reBtn.addEventListener('click', ()=> markReclean(task.id))
  const editBtn=row.querySelector('[data-act="edit"]'); if(editBtn) editBtn.addEventListener('click', ()=> openEditDialog(task.id))
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
  const el=(id,v)=>{ const x=document.getElementById(id); if(x) x.textContent=v }
  el('totalCount', tasks.length); el('dueCount', wait); el('overCount', need); el('doneToday', doneToday)
}

// Doughnut chart (single instance)
function renderContribDonut(){
  const cv=document.getElementById('contribChart'); if(!cv) return
  const now=new Date(), m0=new Date(now.getFullYear(), now.getMonth(), 1), m1=new Date(now.getFullYear(), now.getMonth()+1, 1)
  const lab=document.getElementById('chartMonthLabel'); if(lab){ lab.textContent=`本月 (${m0.getFullYear()}-${String(m0.getMonth()+1).padStart(2,'0')})` }
  const counts={}; for(const r of historyCache){ const t=r.doneAt?new Date(r.doneAt):null; if(!t||t<m0||t>=m1) continue; const k=(r.doneBy||'未填暱稱').trim()||'未填暱稱'; counts[k]=(counts[k]||0)+1 }
  const names=Object.keys(counts), values=names.map(k=>counts[k]), sum=values.reduce((a,b)=>a+b,0)
  const center=document.getElementById('donutCenterText'); if(center) center.textContent=`本月完成 ${sum} 次`
  if(window._ccChart){ window._ccChart.destroy(); window._ccChart=null }
  if(names.length===0){ window._ccChart=new Chart(cv,{type:'doughnut',data:{labels:['尚無紀錄'],datasets:[{data:[1],backgroundColor:['#e5e7eb'],borderWidth:0}]},options:{cutout:'65%',plugins:{legend:{display:false}}}}); if(center) center.textContent='本月完成 0 次'; return }
  const ctx=cv.getContext('2d'), palette=[["#fbd5e6","#f472b6"],["#c7d2fe","#93c5fd"],["#e9d5ff","#c4b5fd"],["#bbf7d0","#86efac"]]
  const backgrounds=names.map((_,i)=>{ const [a,b]=palette[i%palette.length]; const g=ctx.createLinearGradient(0,0,300,300); g.addColorStop(0,a); g.addColorStop(1,b); return g })
  window._ccChart=new Chart(cv,{type:'doughnut',data:{labels:names,datasets:[{data:values,backgroundColor:backgrounds,borderWidth:1,hoverOffset:4}]},options:{cutout:'65%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.label}: ${c.parsed} 次 (${Math.round(c.parsed/sum*1000)/10}%)`}}}}})
}

// ---------- subscriptions & init ----------
function watchTasks(){
  const qy=query(collection(db,COL_TASKS), orderBy('area'), orderBy('name'))
  return onSnapshot(qy, snap=>{ tasks = snap.docs.map(d=>({ ...d.data(), id:d.id })); renderList() })
}
function watchHistory(){
  const qy=query(collection(db,COL_HISTORY), orderBy('doneAtTS','desc'))
  return onSnapshot(qy, snap=>{ 
    historyCache = snap.docs.map(d=>({ id:d.id, ...d.data() }))
    renderContribDonut()
    renderList() // 讓 hover 的「上次完成者」即時更新
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
function exportCSV(){
  const rows=[["區域","項目","週期(天)","上次完成ISO","備註","清潔時間ISO","狀態","重新清潔注意事項","重新清潔次數"]]
  tasks.forEach(t=>{ const st=getStatus(t); const bucket=statusBucket(st.status); rows.push([t.area,t.name,t.days,t.last||'',t.note||'',st.dueAt,bucket,t.recleanNote||'',t.recleanCount||0]) })
  const csv=rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\\n')
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
