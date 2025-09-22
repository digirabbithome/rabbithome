import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// ===== 角色設定（老闆） =====
const MANAGER_EMAILS = new Set([
  'swimming8250@yahoo.com.tw',
  'duckskin71@yahoo.com.tw'
])

// ===== 日期工具（台北時區） =====
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' })
const fmtHM = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour:'2-digit', minute:'2-digit', hour12:false })
function todayYMD(){ return fmtDate.format(new Date()) }
function monthKeyFromYMD(ymd){ return ymd.slice(0,7) } // YYYY-MM

// ===== 狀態 =====
let me = null
let myNickname = '—'
let canViewAll = false
let selectedMonth = null
let currentMonthDocs = []

// ===== DOM =====
const whoami = document.getElementById('whoami')
const todayLabel = document.getElementById('todayLabel')
const monthPicker = document.getElementById('monthPicker')
const searchInput = document.getElementById('searchInput')
const scopeRadios = document.getElementsByName('viewScope')
const viewAllRadio = document.getElementById('viewAll')
const reportTitle = document.getElementById('reportTitle')
const editor = document.getElementById('editor')
const btnSave = document.getElementById('btnSave')
const reportList = document.getElementById('reportList')
const toastEl = document.getElementById('toast')

// Toolbar
const btnUndo = document.getElementById('btnUndo')
const btnRedo = document.getElementById('btnRedo')
const btnClear = document.getElementById('btnClear')
const foreColor = document.getElementById('foreColor')
const backColor = document.getElementById('backColor')

// 選取範圍保存（避免點顏色時 selection 消失）
let savedRange = null
function saveSelection(){ const sel = window.getSelection(); if(sel && sel.rangeCount>0) savedRange = sel.getRangeAt(0) }
function restoreSelection(){ if(savedRange){ const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange) } }
editor.addEventListener('keyup', saveSelection)
editor.addEventListener('mouseup', saveSelection)

// ===== 事件繫結進入點 =====
window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return }
    me = user
    canViewAll = MANAGER_EMAILS.has((me.email || '').toLowerCase())
    // 非老闆隱藏「全部」選項
    if (!canViewAll && viewAllRadio) {
      viewAllRadio.disabled = true
      viewAllRadio.parentElement.style.opacity = 0.35
    }

    whoami.textContent = `${me.displayName || me.email || '使用者'}${canViewAll ? '（老闆）' : ''}`
    todayLabel.textContent = `${todayYMD()} ${fmtHM.format(new Date())}`

    // 嘗試讀取 users/{uid}.nickname
    try {
      const uref = doc(db, 'users', me.uid)
      const usn = await getDoc(uref)
      if (usn.exists() && usn.data().nickname) myNickname = usn.data().nickname
      else myNickname = me.displayName || me.email || '匿名'
    } catch {
      myNickname = me.displayName || me.email || '匿名'
    }

    // 預設月份 = 今天
    selectedMonth = monthKeyFromYMD(todayYMD())
    monthPicker.value = selectedMonth

    bindToolbar()
    bindControls()

    // 載入當月資料
    await loadMonth()

    // 載入今日草稿（若有）
    const todayDoc = currentMonthDocs.find(d => d.uid===me.uid && d.date===todayYMD())
    editor.innerHTML = todayDoc?.contentHtml || ''
    reportTitle.value = todayDoc?.title || ''
  })
}

function bindToolbar(){
  document.querySelectorAll('.dr-toolbar [data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.execCommand(btn.getAttribute('data-cmd'))
      editor.focus()
    })
  })
  btnUndo.addEventListener('click', ()=>document.execCommand('undo'))
  btnRedo.addEventListener('click', ()=>document.execCommand('redo'))
  btnClear.addEventListener('click', ()=>document.execCommand('removeFormat'))
  try { document.execCommand('styleWithCSS', false, true) } catch {}
  foreColor.addEventListener('change', ()=>{ restoreSelection(); document.execCommand('foreColor', false, foreColor.value); editor.focus() })
  backColor.addEventListener('change', ()=>{ restoreSelection(); if(!document.execCommand('hiliteColor', false, backColor.value)){ document.execCommand('backColor', false, backColor.value) } editor.focus() })
}

function bindControls(){
  monthPicker.addEventListener('change', async ()=>{ selectedMonth = monthPicker.value; await loadMonth() })
  searchInput.addEventListener('input', renderList)
  scopeRadios.forEach(r=> r.addEventListener('change', renderList))
  btnSave.addEventListener('click', saveToday)
}

// ===== Firestore 結構說明 =====
// Collection: workReports
// DocID: `${uid}_${date}`  例如: "abc123_2025-09-22"
// Fields:
// - uid, author: { email, nickname }
// - date: 'YYYY-MM-DD'
// - monthKey: 'YYYY-MM'
// - title: string
// - contentHtml: string
// - plainText: string（供搜尋）
// - createdAt, updatedAt: serverTimestamp
// Subcollection: comments （僅老闆可新增）
//   - { text, authorEmail, authorNickname, createdAt }

async function saveToday(){
  const date = todayYMD()
  const id = `${me.uid}_${date}`
  const ref = doc(db, 'workReports', id)
  const data = {
    uid: me.uid,
    author: { email: me.email || '', nickname: myNickname },
    date,
    monthKey: monthKeyFromYMD(date),
    title: (reportTitle.value||'').trim(),
    contentHtml: editor.innerHTML,
    plainText: editor.innerText || '',
    updatedAt: serverTimestamp(),
  }
  const snap = await getDoc(ref)
  if (snap.exists()){
    await updateDoc(ref, data)
    toast('已更新今天的回報')
  } else {
    data.createdAt = serverTimestamp()
    await setDoc(ref, data)
    toast('已建立今天的回報')
  }
  await loadMonth()
}

async function loadMonth(){
  const base = collection(db, 'workReports')
  const conds = [ where('monthKey','==', selectedMonth) ]
  const scope = getScope()
  if (scope==='mine' || !canViewAll){
    conds.push(where('uid','==', me.uid))
  }
  const qy = query(base, ...conds, orderBy('date','desc'))
  const qs = await getDocs(qy)
  currentMonthDocs = qs.docs.map(d=> ({ id:d.id, ...d.data() }))
  renderList()
}

function getScope(){
  const r = Array.from(scopeRadios).find(x=>x.checked)
  return r ? r.value : 'mine'
}

function renderList(){
  const kw = (searchInput.value||'').trim().toLowerCase()
  const list = currentMonthDocs
    .filter(d => !kw || (d.title||'').toLowerCase().includes(kw) || (d.plainText||'').toLowerCase().includes(kw) || (d.author?.nickname||'').toLowerCase().includes(kw))
    .filter(d => d.date !== todayYMD())

  reportList.innerHTML = ''
  if (list.length===0){
    reportList.innerHTML = '<li class="dr-item"><div class="dr-item-body">這個月份目前沒有資料</div></li>'; 
    return
  }

  for (const d of list){
    const li = document.createElement('li')
    li.className = 'dr-item'

    const head = document.createElement('div')
    head.className = 'dr-item-head'
    head.innerHTML = `
      <div>
        <div class="dr-item-title">${escapeHtml(d.title||'(無標題)')}</div>
        <div class="dr-item-meta">${d.date}｜作者：${escapeHtml(d.author?.nickname||'—')}</div>
      </div>
    `

    const body = document.createElement('div')
    body.className = 'dr-item-body'
    body.innerHTML = d.contentHtml || ''

    const replies = document.createElement('div')
    replies.className = 'reply-wrap'
    replies.innerHTML = '<div class="reply-meta">老闆回覆</div>'

    buildRepliesUI(replies, d)

    li.appendChild(head)
    li.appendChild(body)
    li.appendChild(replies)
    reportList.appendChild(li)
  }
}

async function buildRepliesUI(container, reportDoc){
  container.querySelectorAll('.reply-item,.reply-form').forEach(n=>n.remove())

  const cref = collection(db, 'workReports', reportDoc.id, 'comments')
  const qs = await getDocs(query(cref, orderBy('createdAt','asc')))
  qs.forEach(snap => {
    const c = snap.data()
    const item = document.createElement('div')
    item.className = 'reply-item'
    const created = (c.createdAt && c.createdAt.seconds) ? new Date(c.createdAt.seconds*1000).toLocaleString('zh-TW') : new Date().toLocaleString('zh-TW')
    item.innerHTML = `
      <div class="reply-meta">${escapeHtml(c.authorNickname||c.authorEmail||'老闆')}｜${created}</div>
      <div>${escapeHtml(c.text||'')}</div>
    `
    container.appendChild(item)
  })

  if (canViewAll){
    const form = document.createElement('div')
    form.className = 'reply-form'
    form.innerHTML = `
      <input class="reply-input" type="text" placeholder="回覆給 ${escapeHtml(reportDoc.author?.nickname||'同事')}…" />
      <button class="reply-btn">送出</button>
    `
    const input = form.querySelector('input')
    const btn = form.querySelector('button')
    btn.addEventListener('click', async ()=>{
      const text = (input.value||'').trim()
      if (!text) return
      await addDoc(cref, {
        text,
        authorEmail: me.email||'',
        authorNickname: myNickname,
        createdAt: serverTimestamp(),
      })
      input.value=''
      toast('已送出回覆')
      await buildRepliesUI(container, reportDoc)
    })
    container.appendChild(form)
  }
}

function escapeHtml(s){
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'};
  return (s||'').replace(/[&<>"']/g, ch => map[ch]);
}

function toast(msg){
  toastEl.textContent = msg
  toastEl.hidden = false
  setTimeout(()=>{ toastEl.hidden = true }, 1600)
}
