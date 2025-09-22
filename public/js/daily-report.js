import { db, auth } from '/js/firebase.js'
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// 老闆白名單（只有這兩個能回覆）
const MANAGER_EMAILS = new Set([
  'swimming8250@yahoo.com.tw',
  'duckskin71@yahoo.com.tw'
])

// 日期（台北時區）
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' })
const fmtHM = new Intl.DateTimeFormat('zh-TW', { timeZone:'Asia/Taipei', hour:'2-digit', minute:'2-digit', hour12:false })
function todayYMD(){ return fmtDate.format(new Date()) }            // YYYY-MM-DD
function addDays(ymd, delta){ const d = new Date(ymd); d.setDate(d.getDate()+delta); return fmtDate.format(d) }

// 狀態
let me = null
let myNickname = '—'
let canReply = false        // 只有老闆可回覆
let selectedScope = 'all'   // 所有人預設「全部」
let docs60 = []             // 最近 60 天的原始文件

// DOM
const whoami = document.getElementById('whoami')
const todayLabel = document.getElementById('todayLabel')
const rangeText = document.getElementById('rangeText')
const searchInput = document.getElementById('searchInput')
const reportTitle = document.getElementById('reportTitle')
const editor = document.getElementById('editor')
const btnSave = document.getElementById('btnSave')
const reportList = document.getElementById('reportList')
const toastEl = document.getElementById('toast')
const viewAllRadio = document.getElementById('viewAll')
const viewMineRadio = document.getElementById('viewMine')

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
    canReply = MANAGER_EMAILS.has((me.email || '').toLowerCase())

    whoami.textContent = `${me.displayName || me.email || '使用者'}${canReply ? '（老闆）' : ''}`
    todayLabel.textContent = `${todayYMD()} ${fmtHM.format(new Date())}`

    try {
      const uref = doc(db, 'users', me.uid)
      const usn = await getDoc(uref)
      if (usn.exists() && usn.data().nickname) myNickname = usn.data().nickname
      else myNickname = me.displayName || me.email || '匿名'
    } catch {
      myNickname = me.displayName || me.email || '匿名'
    }

    bindToolbar()
    bindControls()
    await loadRecent60Days()

    // 填入今日資料（若有）
    const todayDoc = docs60.find(d => d.uid===me.uid && d.date===todayYMD())
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
  viewAllRadio.addEventListener('change', ()=>{ selectedScope='all'; renderList() })
  viewMineRadio.addEventListener('change', ()=>{ selectedScope='mine'; renderList() })
  searchInput.addEventListener('input', renderList)
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
    monthKey: date.slice(0,7),
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
  await loadRecent60Days()
}

// 載入最近 60 天
async function loadRecent60Days(){
  const end = todayYMD()
  const start = addDays(end, -59) // 含今天，共 60 天
  rangeText.textContent = `${start} ~ ${end}`

  const base = collection(db, 'workReports')
  const conds = [ where('date','>=', start) ]
  // 可視篩選（若只看我的，就在渲染階段過濾，避免組合索引需求）
  const qy = query(base, ...conds, orderBy('date','desc'))
  const qs = await getDocs(qy)
  docs60 = qs.docs.map(d => ({ id: d.id, ...d.data() }))
  renderList()
}

// 渲染（以日期分組）
function renderList(){
  const kw = (searchInput.value||'').trim().toLowerCase()

  // 先依關鍵字與視角過濾
  let pool = docs60.filter(d => {
    if (selectedScope==='mine' && d.uid !== me.uid) return false
    if (kw){
      const hay = [(d.title||''), (d.plainText||''), (d.author?.nickname||'')].join(' ').toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })

  // 依日期分組
  const byDate = new Map()
  for (const d of pool){
    if (!byDate.has(d.date)) byDate.set(d.date, [])
    byDate.get(d.date).push(d)
  }

  // 依日期排序（新到舊）
  const days = Array.from(byDate.keys()).sort((a,b)=> a<b?1:-1)

  reportList.innerHTML = ''
  if (days.length===0){
    reportList.innerHTML = '<li class="day-card"><div class="day-head"><div class="day-date">沒有資料</div><div class="day-meta">請調整篩選或明天再來</div></div></li>';
    return
  }

  for (const day of days){
    const card = document.createElement('li')
    card.className = 'day-card'

    const head = document.createElement('div')
    head.className = 'day-head'
    head.innerHTML = `<div class="day-date">📅 ${day}</div><div class="day-meta">共 ${byDate.get(day).length} 則</div>`

    const body = document.createElement('div')
    body.className = 'day-body'

    // 這一天的每位同事
    for (const d of byDate.get(day)){
      const box = document.createElement('div')
      box.className = 'person-item'

      const head2 = document.createElement('div')
      head2.className = 'person-head'
      head2.innerHTML = `
        <div class="person-name">${escapeHtml(d.author?.nickname || '—')}</div>
        <div class="person-title">${escapeHtml(d.title || '(無標題)')}</div>
      `

      const content = document.createElement('div')
      content.className = 'person-content'
      content.innerHTML = d.contentHtml || ''

      // 回覆區塊（有回覆才顯示列表；老闆永遠可回覆，但 0 筆時不顯示 (0) 計數）
      const replies = Array.isArray(d.replies) ? d.replies : []

      // 1) 有回覆 → 顯示回覆區與清單（同事/老闆都會看到）
      if (replies.length > 0) {
        const replyWrap = document.createElement('div')
        replyWrap.className = 'reply-wrap'
        replyWrap.innerHTML = `<div class="reply-meta">💬 老闆回覆（${replies.length}）</div>`
        for (const r of replies){
          const item = document.createElement('div')
          item.className = 'reply-item'
          const who = (r?.boss?.nickname || r?.boss?.email || '老闆')
          const when = r?.createdAt?.seconds ? new Date(r.createdAt.seconds*1000).toLocaleString('zh-TW') : ''
          item.innerHTML = `<div class="reply-meta">${escapeHtml(who)} ${when ? '｜'+when : ''}</div><div>${escapeHtml(r?.text||'')}</div>`
          replyWrap.appendChild(item)
        }
        // 老闆在列表下方附上輸入框
        if (canReply){
          const form = document.createElement('div')
          form.className = 'reply-form'
          form.innerHTML = `
            <input class="reply-input" type="text" placeholder="回覆給 ${escapeHtml(d.author?.nickname || '同事')}…" />
            <button class="reply-btn">送出回覆</button>
          `
          const input = form.querySelector('input')
          const btn = form.querySelector('button')
          btn.addEventListener('click', async ()=>{
            const text = (input.value||'').trim()
            if (!text) return
            const ref = doc(db, 'workReports', d.id)
            const snap = await getDoc(ref)
            const current = (snap.exists() && Array.isArray(snap.data().replies)) ? snap.data().replies.slice() : []
            current.push({
              boss: { email: me.email || '', nickname: myNickname || '老闆' },
              text,
              createdAt: Timestamp.now()
            })
            await updateDoc(ref, { replies: current })
            input.value = ''
            toast('已送出回覆')
            await loadRecent60Days()
          })
          replyWrap.appendChild(form)
        }
        box.appendChild(replyWrap)
      } else if (canReply) {
        // 2) 無回覆且為老闆 → 只顯示輸入框（不顯示 (0) 計數）
        const replyWrap = document.createElement('div')
        replyWrap.className = 'reply-wrap'
        replyWrap.innerHTML = `<div class="reply-meta">💬 老闆回覆</div>`
        const form = document.createElement('div')
        form.className = 'reply-form'
        form.innerHTML = `
          <input class="reply-input" type="text" placeholder="回覆給 ${escapeHtml(d.author?.nickname || '同事')}…" />
          <button class="reply-btn">送出回覆</button>
        `
        const input = form.querySelector('input')
        const btn = form.querySelector('button')
        btn.addEventListener('click', async ()=>{
          const text = (input.value||'').trim()
          if (!text) return
          const ref = doc(db, 'workReports', d.id)
          const snap = await getDoc(ref)
          const current = (snap.exists() && Array.isArray(snap.data().replies)) ? snap.data().replies.slice() : []
          current.push({
            boss: { email: me.email || '', nickname: myNickname || '老闆' },
            text,
            createdAt: Timestamp.now()
          })
          await updateDoc(ref, { replies: current })
          input.value = ''
          toast('已送出回覆')
          await loadRecent60Days()
        })
        replyWrap.appendChild(form)
        box.appendChild(replyWrap)
      }

      body.appendChild(box)
    }

    card.appendChild(head)
    card.appendChild(body)
    reportList.appendChild(card)
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
