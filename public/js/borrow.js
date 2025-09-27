// borrow.js v1.1 - 借貨管理 (只在表格顯示縮圖 + hover 放大)
import { db, auth, storage } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, query, orderBy, where,
  getDocs, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytesResumable, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const fmtDate = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })
const pageSize = 30

let me, nickname = '', currentFilter = 'pending', kw = ''

window.onload = () => {
  bindUI()
  onAuthStateChanged(auth, async user => {
    if (!user) { document.getElementById('whoami').textContent = '請先登入'; return }
    me = user
    document.getElementById('whoami').textContent = user.email || user.uid
    nickname = await loadNickname(user) || user.displayName || (user.email ? user.email.split('@')[0] : '未命名')
    loadList()
  })
}

async function loadNickname(user){
  try{
    const { doc:docFn, getDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
    const dref = docFn(db, 'profiles', user.uid)
    const snap = await getDoc(dref)
    return snap.exists() ? (snap.data().nickname || '') : ''
  }catch(e){ return '' }
}

function bindUI(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active')
      currentFilter = btn.dataset.filter
      loadList()
    })
  })
  document.getElementById('kw').addEventListener('input', e=>{
    kw = e.target.value.trim()
    loadList()
  })
  document.getElementById('borrowForm').addEventListener('submit', onSubmit)
  document.getElementById('photos').addEventListener('change', previewFiles)
  document.getElementById('prevPage').addEventListener('click', ()=> paginate(-1))
  document.getElementById('nextPage').addEventListener('click', ()=> paginate(1))
}

function previewFiles(e){
  const box = document.getElementById('photoPreview')
  box.innerHTML = ''
  const files = Array.from(e.target.files||[])
  files.slice(0,12).forEach(f=>{
    const url = URL.createObjectURL(f)
    const img = document.createElement('img')
    img.src = url
    box.appendChild(img)
  })
}

async function onSubmit(ev){
  ev.preventDefault()
  if(!me){ alert('請先登入'); return }
  const itemName = document.getElementById('itemName').value.trim()
  const assignee = document.getElementById('assignee').value.trim()
  const desc = document.getElementById('desc').value.trim()
  const files = Array.from(document.getElementById('photos').files||[])
  if(!itemName || !assignee){ alert('商品與取走者為必填'); return }

  const data = {
    itemName, assignee, desc,
    deliveredBy: nickname,
    deliveredByUid: me.uid,
    deliveredAt: serverTimestamp(),
    status: 'pending',
    photos: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
  const col = collection(db, 'borrows')
  const docRef = await addDoc(col, data)

  if(files.length){
    const prog = document.getElementById('upProgress')
    let done = 0
    for(const f of files){
      const p = `borrows/${docRef.id}/${Date.now()}_${sanitizeName(f.name)}`
      const sref = ref(storage, p)
      await new Promise((resolve,reject)=>{
        const task = uploadBytesResumable(sref, f, { contentType: f.type })
        task.on('state_changed', null, reject, async ()=>{
          const url = await getDownloadURL(sref)
          await updateDoc(docRef, { photos: [ ...(data.photos||[]), {url, path:p, name:f.name, contentType:f.type} ] })
          done++
          prog.textContent = `上傳 ${done}/${files.length}`
          resolve()
        })
      })
    }
    prog.textContent = '上傳完成'
  }

  ev.target.reset()
  document.getElementById('photoPreview').innerHTML=''
  loadList()
}

function sanitizeName(n){ return n.replace(/[^\u4E00-\u9FFF\w.-]+/g,'_') }

async function buildQuery(){
  const col = collection(db, 'borrows')
  let q = query(col, orderBy('createdAt','desc'))
  if(currentFilter==='pending'){
    q = query(col, where('status','==','pending'), orderBy('createdAt','desc'))
  }else if(currentFilter==='completed'){
    q = query(col, where('status','in',['returned','refunded']), orderBy('createdAt','desc'))
  }
  const snaps = await getDocs(q)
  let rows = snaps.docs.map(d=>({ id:d.id, ...d.data() }))
  if(kw){
    const K = kw.toLowerCase()
    rows = rows.filter(r=>(
      (r.itemName||'').toLowerCase().includes(K) ||
      (r.assignee||'').toLowerCase().includes(K) ||
      (r.desc||'').toLowerCase().includes(K)
    ))
  }
  return rows
}

async function loadList(){
  const rows = await buildQuery()
  window._rows = rows
  window._page = 1
  updatePage()
}

function updatePage(){
  const rows = window._rows || []
  const page = window._page || 1
  const start = (page-1)*pageSize
  const end = start + pageSize
  renderTable(rows.slice(start,end))
  document.getElementById('pageInfo').textContent = `第 ${page} 頁 / 共 ${Math.max(1, Math.ceil(rows.length/pageSize))} 頁（${rows.length} 筆）`
  document.getElementById('prevPage').disabled = page<=1
  document.getElementById('nextPage').disabled = end>=rows.length
}

function paginate(dir){
  const rows = window._rows||[]
  const total = Math.max(1, Math.ceil(rows.length/pageSize))
  window._page = Math.min(total, Math.max(1, (window._page||1)+dir))
  updatePage()
}

function badgeHTML(s){
  const map = { pending:'未完成', returned:'已還回', refunded:'已退款' }
  return `<span class="badge ${s}">${map[s]||s}</span>`
}

function renderTable(rows){
  const tb = document.getElementById('tbody')
  tb.innerHTML = ''
  for(const r of rows){
    const t = r.deliveredAt?.toDate ? r.deliveredAt.toDate() : (r.createdAt?.toDate ? r.createdAt.toDate() : new Date())
    const time = `${fmtDate.format(t)} ${fmtTime.format(t)}`
    const img = (r.photos && r.photos[0]?.url) ? `
      <div class="thumb-wrap">
        <img src="${r.photos[0].url}" class="thumb">
        <img src="${r.photos[0].url}" class="thumb-large">
      </div>` : ''
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${time}</td>
      <td>${img} ${escapeHTML(r.itemName||'')}</td>
      <td>${escapeHTML(r.assignee||'')}</td>
      <td>${escapeHTML(r.deliveredBy||'')}</td>
      <td>${badgeHTML(r.status||'pending')}</td>
      <td title="${escapeHTML(r.desc||'')}">${escapeHTML(shorten(r.desc||'', 30))}</td>
      <td class="row-actions">
        ${ r.status==='pending' ? `
        <button class="btn" data-act="returned" data-id="${r.id}">✅ 還回</button>
        <button class="btn" data-act="refunded" data-id="${r.id}">💸 退款</button>` : '' }
        ${ r.status!=='pending' ? `<button class="btn" data-act="reopen" data-id="${r.id}">↩️ 重新開啟</button>` : '' }
      </td>
    `
    tb.appendChild(tr)
  }
  tb.querySelectorAll('button[data-id]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.dataset.id
      const act = btn.dataset.act
      if(act==='returned' || act==='refunded'){
        await updateDoc(doc(db,'borrows',id), { status: act, updatedAt: serverTimestamp() })
      }else if(act==='reopen'){
        await updateDoc(doc(db,'borrows',id), { status: 'pending', updatedAt: serverTimestamp() })
      }
      loadList()
    })
  })
}

function escapeHTML(s){ return s.replace(/[&<>"]/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[ch])) }
function shorten(s, n){ return s.length>n ? (s.slice(0,n)+'…') : s }
