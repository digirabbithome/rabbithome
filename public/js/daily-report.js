import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// 老闆白名單
const MANAGER_EMAILS = new Set([
  'swimming8250@yahoo.com.tw',
  'duckskin71@yahoo.com.tw'
])

// 日期（台北時區）
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' })
const fmtHM = new Intl.DateTimeFormat('zh-TW', { timeZone:'Asia/Taipei', hour:'2-digit', minute:'2-digit', hour12:false })
function todayYMD(){ return fmtDate.format(new Date()) }
function monthKeyFromYMD(ymd){ return ymd.slice(0,7) } // YYYY-MM

// 狀態
let me = null
let myNickname = '—'
let canViewAll = false
let selectedMonth = null
let currentMonthDocs = []

// DOM
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

// 選取範圍保存
let savedRange = null
function saveSelection(){ const sel = window.getSelection(); if(sel && sel.rangeCount>0) savedRange = sel.getRangeAt(0) }
function restoreSelection(){ if(savedRange){ const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange) } }
editor.addEventListener('keyup', saveSelection)
editor.addEventListener('mouseup', saveSelection)

// 入口
window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return }
    me = user
    canViewAll = MANAGER_EMAILS.has((me.email || '').toLowerCase())

    // 老闆預設選「全部」，同事禁用「全部」
    if (canViewAll && viewAllRadio) {
      viewAllRadio.checked = true
    } else if (!canViewAll && viewAllRadio) {
      viewAllRadio.disabled = true
      viewAllRadio.parentElement.style.opacity = 0.35
    }

    whoami.textContent = `${me.displayName || me.email || '使用者'}${canViewAll ? '（老闆）' : ''}`
    todayLabel.textContent = `${todayYMD()} ${fmtHM.format(new Date())}`

    try {
      const uref = doc(db, 'users', me.uid)
      const usn = await getDoc(uref)
      if (usn.exists() && usn.data().nickname) myNickname = usn.data().nickname
      else myNickname = me.displayName || me.email || '匿名'
    } catch {
      myNickname = me.displayName || me.email || '匿名'
    }

    selectedMonth = monthKeyFromYMD(todayYMD())
    monthPicker.value = selectedMonth

    console.log('[DailyReport] signedIn', {email: me.email, canViewAll, selectedMonth})

    bindToolbar()
    bindControls()
    await loadMonth()

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
  scopeRadios.forEach(r=> r.addEventListener('change', async ()=>{ await loadMonth() }))
  btnSave.addEventListener('click', saveToday)
}

// 儲存今天
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

// 載入月份
async function loadMonth(){
  const baseCol = collection(db, 'workReports')
  const m1 = selectedMonth
  const m2 = selectedMonth.replace('-', '/')
  const monthKeys = Array.from(new Set([m1, m2]))

  const conds = [ where('monthKey','in', monthKeys) ]
  const scope = getScope()
  if (scope==='mine' || !canViewAll){
    conds.push(where('uid','==', me.uid))
  }
  const qy = query(baseCol, ...conds, orderBy('date','desc'))
  console.log('[DailyReport] query', { scope: getScope(), monthKeys, canViewAll, email: me?.email })
  const qs = await getDocs(qy)
  currentMonthDocs = qs.docs.map(d=> ({ id:d.id, ...d.data() }))
  console.log('[DailyReport] results', { count: currentMonthDocs.length, sample: currentMonthDocs.slice(0,3).map(x=>({id:x.id, date:x.date, uid:x.uid})) })
  renderList()
}

function getScope(){
  const r = Array.from(scopeRadios).find(x=>x.checked)
  return r ? r.value : 'mine'
}

// 渲染清單（只隱藏「我自己的今天」）
function renderList(){
  const keyword = (searchInput.value || '').trim().toLowerCase()

  const list = currentMonthDocs
    .filter(d => !keyword
      || (d.title || '').toLowerCase().includes(keyword)
      || (d.plainText || '').toLowerCase().includes(keyword)
      || (d.author?.nickname || '').toLowerCase().includes(keyword))
    .filter(d => !(d.uid === me.uid && d.date === todayYMD()))

  reportList.innerHTML = ''
  if (list.length === 0){
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
        <div class="dr-item-title">${escapeHtml(d.title || '(無標題)')}</div>
        <div class="dr-item-meta">${d.date}｜作者：${escapeHtml(d.author?.nickname || '—')}</div>
      </div>
    `

    const body = document.createElement('div')
    body.className = 'dr-item-body'
    body.innerHTML = d.contentHtml || ''

    li.appendChild(head)
    li.appendChild(body)
    reportList.appendChild(li)
  }
}

// 工具
function escapeHtml(s){ 
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return (s||'').replace(/[&<>"']/g, ch => map[ch]); 
}

function toast(msg){
  toastEl.textContent = msg
  toastEl.hidden = false
  setTimeout(()=>{ toastEl.hidden = true }, 1600)
}
