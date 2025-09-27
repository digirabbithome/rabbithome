import { db, auth } from '/js/firebase.js'
import { 
  collection, addDoc, getDocs, onSnapshot, updateDoc, doc, 
  deleteDoc, serverTimestamp, arrayUnion, getDoc 
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// ---------- Utils ----------
const $ = (s)=>document.querySelector(s)
const todayISO = () => new Date().toISOString().slice(0,10)
let currentNickname = '未登入'
const nickname = () => currentNickname
const daysSince = (dstr) => Math.floor((Date.now()-new Date(dstr).getTime())/86400000)

function levelPercent(item){
  const cd=Math.max(1,Number(item.cycleDays)||30)
  const elapsed=daysSince(item.lastCharge||todayISO())
  const remainRatio=Math.max(0,Math.min(1,1-(elapsed/cd)))
  if(remainRatio<=0) return 0
  if(remainRatio<=0.25) return 25
  if(remainRatio<=0.5) return 50
  if(remainRatio<=0.75) return 75
  return 100
}
function colorByPercent(p){
  if(p===0) return {border:'#cbd5e1',cells:'#cbd5e1'}
  if(p===25) return {border:'#ef4444',cells:'#ef4444'}
  if(p===50) return {border:'#f59e0b',cells:'#f59e0b'}
  if(p===75) return {border:'#eab308',cells:'#eab308'}
  return {border:'#22c55e',cells:'#22c55e'}
}

// ---------- State ----------
let unsubscribe=null
let currentFilter = { overdue:false, location:null }
let currentSort = 'stale' // name | location | stale

// single floating hint
const hintEl = document.createElement('div')
hintEl.className = 'hint'
document.body.appendChild(hintEl)
document.body.addEventListener('mousemove', e => {
  if (hintEl.style.display === 'block') {
    hintEl.style.left = (e.pageX + 16) + 'px'
    hintEl.style.top  = (e.pageY + 12) + 'px'
  }
})

// ---------- Render ----------
function render(list){
  // KPI
  $('#kpiTotal').textContent = list.length
  const over=list.filter(x=>levelPercent(x)===0).length; $('#kpiOver').textContent=over

  const q=$('#q')?.value.trim().toLowerCase() || ''
  let data=[...list]
  if(q){data=data.filter(x=>`${x.name} ${x.location} ${x.note}`.toLowerCase().includes(q))}
  if(currentFilter.overdue){data=data.filter(x=>levelPercent(x)===0)}
  if(currentFilter.location){data=data.filter(x=>(x.location||'')===currentFilter.location)}

  data.sort((a,b)=>{
    const pa=levelPercent(a), pb=levelPercent(b)
    if(pa!==pb) return pa-pb
    if(currentSort==='name') return (a.name||'').localeCompare(b.name||'')
    if(currentSort==='location') return (a.location||'').localeCompare(b.location||'')
    return daysSince(b.lastCharge||0)-daysSince(a.lastCharge||0)
  })

  const listEl=$('#list')
  const empty=$('#empty')
  listEl.innerHTML=''
  if(!data.length){ empty.style.display='block'; updateFilterChips(); return } else { empty.style.display='none' }

  for(const item of data){
    const p=levelPercent(item)
    const {border,cells}=colorByPercent(p)
    const onCells=p===100?4:p===75?3:p===50?2:p===25?1:0
    const overdue=p===0
    const history=(item.history||[]).slice(-5).reverse()
    const historyHtml = history.length?history.map(h=>`• ${h.user||h.by||'—'}：${h.date||''}`).join('<br>'):'— 無紀錄 —'

    const div=document.createElement('div')
    div.className='item card-item'
    div.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div class="battery" style="border-color:${border}; --tip-color:${cells}" data-hint="${historyHtml.replace(/"/g,'&quot;')}">
          <div class="cell ${onCells>=1?'on':''}" style="background:${cells}"></div>
          <div class="cell ${onCells>=2?'on':''}" style="background:${cells}"></div>
          <div class="cell ${onCells>=3?'on':''}" style="background:${cells}"></div>
          <div class="cell ${onCells>=4?'on':''}" style="background:${cells}"></div>
        </div>
        <div style="text-align:right">
          <div class="mini muted">週期 ${item.cycleDays||30} 天</div>
          <div class="mini" style="color:${overdue?'#ef4444':'#6b7280'}">上次充電：${item.lastCharge||'—'}</div>
        </div>
      </div>
      <div class="title" title="${item.name||''}"><a href="#" data-act="edit" data-id="${item.id}">${item.name||''}</a></div>
      <div class="meta" title="${item.location||''}">
        <a href="#" data-act="filterLoc" data-loc="${item.location||''}" class="muted">${item.location||''}</a>
        <span class="actions">
          <a href="#" data-act="charge" data-id="${item.id}">已充電</a>
        </span>
      </div>
    `
    listEl.appendChild(div)
  }

  // 綁定 hover 顯示歷史（跟著滑鼠）
  listEl.querySelectorAll('.battery').forEach(bat=>{
    bat.addEventListener('mouseenter',()=>{
      hintEl.innerHTML = '<div style="opacity:.7;margin-bottom:4px">最近 5 次充電：</div>'+bat.dataset.hint
      hintEl.style.display='block'
    })
    bat.addEventListener('mouseleave',()=>{ hintEl.style.display='none' })
  })

  updateFilterChips()
}

function updateFilterChips(){
  const chips=[]
  if(currentFilter.overdue) chips.push('篩選：逾期需充')
  if(currentFilter.location) chips.push(`倉庫：${currentFilter.location}`)
  $('#activeFilters').textContent = chips.length ? chips.join(' ｜ ') : ''
}

// ---------- Firestore ----------
const colRef = collection(db,'batteries')

async function loadRealtime(){
  if(unsubscribe) unsubscribe()
  unsubscribe = onSnapshot(colRef,(snap)=>{
    const list=[]; snap.forEach(d=>list.push({id:d.id,...d.data()}))
    render(list)
  })
}

async function chargeBatteryDoc(id){
  const now=todayISO()
  await updateDoc(doc(db,'batteries',id),{
    lastCharge:now,
    updatedAt:serverTimestamp(),
    history:arrayUnion({user:nickname(),date:now})
  })
}
async function removeBatteryDoc(id){ await deleteDoc(doc(db,'batteries',id)) }
async function addBatteryDoc(data){ await addDoc(colRef,{...data,createdAt:serverTimestamp(),history:[]}) }
async function updateBatteryDoc(id,data){ await updateDoc(doc(db,'batteries',id),{...data,updatedAt:serverTimestamp()}) }

// ---------- Dialog / Form ----------
const dlg = $('#dlg')
const frm = $('#frm')
const deleteBtn = $('#deleteBtn')
let editingId = null

function openNew(){
  editingId=null
  frm.reset()
  deleteBtn.style.display='none'
  $('#dlgTitle').textContent='新增品相'
  dlg.showModal()
}
async function openEditById(id){
  const snap = await getDocs(colRef)
  let item=null; snap.forEach(d=>{ if(d.id===id) item={id:d.id,...d.data()} })
  if(!item) return
  editingId=item.id
  frm.name.value=item.name||''
  frm.cycleDays.value=item.cycleDays||30
  frm.lastCharge.value=item.lastCharge||''
  frm.location.value=item.location||''
  frm.note.value=item.note||''
  deleteBtn.style.display='inline-block'
  $('#dlgTitle').textContent='編輯品相'
  dlg.showModal()
}

// ---------- Events ----------
document.addEventListener('DOMContentLoaded', ()=>{
  $('#newBtn').addEventListener('click', openNew)
  $('#kpiOverWrap').addEventListener('click', ()=>{ currentFilter.overdue = true; loadRealtime() })
  $('#kpiAll').addEventListener('click', ()=>{ currentFilter.overdue = false; currentFilter.location=null; $('#q').value=''; loadRealtime() })
  $('#q').addEventListener('input', ()=>loadRealtime())
  $('#sortBy').addEventListener('change', (e)=>{ currentSort=e.target.value; loadRealtime() })

  $('#list').addEventListener('click', async (e)=>{
    const a=e.target.closest('a'); if(!a) return; e.preventDefault()
    const act=a.dataset.act; const id=a.dataset.id; const loc=a.dataset.loc
    if(act==='filterLoc'){ currentFilter.location = (currentFilter.location===loc)? null : loc; loadRealtime(); return }
    if(act==='charge' && id){ await chargeBatteryDoc(id); return }
    if(act==='edit' && id){ await openEditById(id); return }
  })

  frm.addEventListener('submit', async (e)=>{
    e.preventDefault()
    const fd=new FormData(frm)
    const data={
      name:(fd.get('name')||'').trim(),
      cycleDays:Math.max(1,Number(fd.get('cycleDays'))||30),
      lastCharge:fd.get('lastCharge')||null,
      location:fd.get('location')||'',
      note:fd.get('note')||''
    }
    if(!editingId){
      if(!data.lastCharge){
        const d=new Date(); d.setDate(d.getDate()-data.cycleDays)
        data.lastCharge = d.toISOString().slice(0,10)
      }
      await addBatteryDoc(data)
    }else{
      await updateBatteryDoc(editingId,data)
    }
    dlg.close()
  })

  deleteBtn.addEventListener('click', async ()=>{
    if(editingId && confirm('確定刪除？')){
      await removeBatteryDoc(editingId)
      dlg.close()
    }
  })
})

// ---------- Auth & nickname ----------
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    try{ await signInAnonymously(auth) }catch(e){ console.error(e) }
  }else{
    try{
      const u = await getDoc(doc(db,'users',user.uid))
      if(u.exists()){
        currentNickname = u.data().nickname || user.displayName || user.email || '匿名'
      }else{
        currentNickname = user.displayName || user.email || '匿名'
      }
    }catch(e){ console.warn('讀取暱稱失敗', e) }
    loadRealtime()
  }
})