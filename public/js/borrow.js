// borrow.js v1.3 - 修正：單張縮圖、hover 才放大、已完成只查半年內、商品名稱可空白
import { db, auth, storage } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, query, orderBy, where,
  doc, updateDoc, onSnapshot, arrayUnion
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytesResumable, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const fmtDate = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })
const pageSize = 30

let me, nickname = '', currentFilter = 'pending', kw = ''
let unsub = null, lastCreatedId = null

window.onload = () => {
  bindUI()
  onAuthStateChanged(auth, async user => {
    if (!user) { document.getElementById('whoami').textContent = '請先登入'; return }
    me = user
    document.getElementById('whoami').textContent = user.email || user.uid
    nickname = await loadNickname(user) || user.displayName || (user.email ? user.email.split('@')[0] : '未命名')
    attachRealtime()
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
      attachRealtime()
    })
  })
  document.getElementById('kw').addEventListener('input', e=>{
    kw = e.target.value.trim()
    updatePage()
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
  if(!nickname || nickname==='未命名'){ alert('請先在個人資料設定暱稱'); return }
  const itemName = document.getElementById('itemName').value.trim()
  const assignee = document.getElementById('assignee').value.trim()
  const desc = document.getElementById('desc').value.trim()
  const files = Array.from(document.getElementById('photos').files||[])
  if(!assignee){ alert('請填寫取走者'); return }

  const data = {
    itemName: itemName || '', assignee, desc,
    deliveredBy: nickname,
    deliveredByUid: me.uid,
    deliveredAt: serverTimestamp(),
    status: 'pending',
    photos: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
  const colRef = collection(db, 'borrows')
  const docRef = await addDoc(colRef, data)
  lastCreatedId = docRef.id
  const debug = document.getElementById('debugDocId'); if (debug) debug.textContent = lastCreatedId

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
          await updateDoc(docRef, { photos: arrayUnion({url, path:p, name:f.name, contentType:f.type}), updatedAt: serverTimestamp() })
          done++
          if(prog) prog.textContent = `上傳 ${done}/${files.length}`
          resolve()
        })
      })
    }
    if(prog) prog.textContent = '上傳完成'
  }

  ev.target.reset()
  document.getElementById('photoPreview').innerHTML=''
}

function sanitizeName(n){ return n.replace(/[^\u4E00-\u9FFF\w.-]+/g,'_') }

function sixMonthsAgo(){
  const d = new Date(); d.setMonth(d.getMonth()-6); return d
}

function attachRealtime(){
  if(unsub){ unsub(); unsub = null }
  const colRef = collection(db, 'borrows')
  let q = query(colRef, orderBy('createdAt', 'desc'))
  if(currentFilter==='pending'){
    q = query(colRef, where('status','==','pending'), orderBy('createdAt','desc'))
  }else if(currentFilter==='completed'){
    // 只查半年內
    q = query(colRef, where('status','in',['returned','refunded']), where('createdAt','>=', sixMonthsAgo()), orderBy('createdAt','desc'))
  }
  unsub = onSnapshot(q, snap => {
    let rows = snap.docs.map(d => ({ id:d.id, ...d.data() }))
    const dbg = document.getElementById('debugCount'); if (dbg) dbg.textContent = rows.length
    if(kw){
      const K = kw.toLowerCase()
      rows = rows.filter(r=>(
        (r.itemName||'').toLowerCase().includes(K) ||
        (r.assignee||'').toLowerCase().includes(K) ||
        (r.desc||'').toLowerCase().includes(K)
      ))
    }
    window._rows = rows
    window._page = 1
    updatePage()
  }, err => {
    console.error('onSnapshot error', err)
    const warn = document.getElementById('ruleWarn'); if (warn) warn.style.display = 'inline'
  })
}

function updatePage(){
  const rows = (window._rows || [])
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
    const firstUrl = (r.photos && r.photos[0]?.url) || ''
    const img = firstUrl ? `
      <div class="thumb-wrap">
        <img src="${firstUrl}" class="thumb" alt="thumb">
        <img src="${firstUrl}" class="thumb-large" alt="preview" style="display:none">
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
    })
  })
}

function escapeHTML(s){ return s.replace(/[&<>"]/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[ch])) }
function shorten(s, n){ return s.length>n ? (s.slice(0,n)+'…') : s }
