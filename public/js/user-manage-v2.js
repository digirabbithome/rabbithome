import { db, auth } from '/js/firebase.js'
import {
  collection, getDocs, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  onAuthStateChanged, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// 管理者帳號清單
const allowedEmails = [
  'swimming8250@yahoo.com.tw',
  'duckskin@yahoo.com.tw'
]

let users = []
let filter = 'all'
let myEmail = ''

window.onload = () => {
  onAuthStateChanged(auth, async (me) => {
    myEmail = me?.email || ''
    await loadUsers()
    bindUI()
    render()
  })
}

async function loadUsers() {
  const snap = await getDocs(collection(db, 'users'))
  users = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => {
      // 管理者看到所有人
      if (allowedEmails.includes(myEmail)) return true
      // 一般人只能看到自己
      return u.email === myEmail
    })
}

function bindUI() {
  const tabs = document.getElementById('tabs')
  tabs?.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]')
    if (!btn) return
    tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    filter = btn.dataset.filter
    render()
  })

  const list = document.getElementById('list')

  list.addEventListener('change', async e => {
    const sel = e.target.closest('select[data-id]')
    if (!sel) return
    await updateDoc(doc(db,'users',sel.dataset.id), { employment: sel.value })
    await loadUsers(); render()
  })

  list.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    const email = btn.dataset.email
    const u = users.find(x=>x.id===id)

    if (btn.dataset.action === 'reset') {
      if (!email) return alert('此帳號沒有 email')
      await sendPasswordResetEmail(auth, email).then(()=>alert('已寄出重設密碼信')).catch(err=>alert(err.message))
    }

    if (btn.dataset.action === 'hire') {
      const d = prompt('設定入職日 (YYYY-MM-DD)：', u?.hireDate || '')
      if (!d) return
      await updateDoc(doc(db,'users',id), { hireDate: d })
      await loadUsers(); render()
    }

    if (btn.dataset.action === 'quota') {
      const p = u?.annualLeavePolicy || {}
      const base = prompt('本年度年假配額（天）：', p.baseDays ?? 0)
      const carry = prompt('結轉天數（可留空）：', p.carryOverDays ?? 0)
      const adj = prompt('手動調整（可負數）：', p.manualAdjust ?? 0)
      const eff = prompt('生效日 YYYY-MM-DD（預設每年1/1）：', p.effectiveFrom || `${new Date().getFullYear()}-01-01`)
      await updateDoc(doc(db,'users',id), {
        annualLeavePolicy: {
          baseDays: Number(base||0),
          carryOverDays: Number(carry||0),
          manualAdjust: Number(adj||0),
          effectiveFrom: eff
        }
      })
      await loadUsers(); render()
    }
  })
}

function calcSeniorityYears(hireDateStr) {
  if (!hireDateStr) return 0
  const today = new Date()
  const hire = new Date(hireDateStr + 'T00:00:00')
  const diff = today - hire
  return Math.max(0, Math.floor(diff / (365.25*24*60*60*1000)))
}

function remaining(u, year = new Date().getFullYear()) {
  const p = u.annualLeavePolicy || {}
  const stats = u.leaveStats?.year === year ? u.leaveStats : { approvedTaken:0 }
  const eff = p.effectiveFrom ? new Date(p.effectiveFrom + 'T00:00:00') : null
  const now = new Date()
  const quota = (eff && now < eff) ? 0 : (Number(p.baseDays||0) + Number(p.carryOverDays||0) + Number(p.manualAdjust||0))
  const used = Number(stats.approvedTaken||0)
  return { quota, used, left: Math.max(0, quota - used) }
}

function labelEmployment(v) {
  return v==='part-time' ? '兼職' : v==='resigned' ? '離職' : '正職'
}
function opt(v,text,cur){ return `<option value="${v}" ${cur===v?'selected':''}>${text}</option>` }

function render() {
  const data = users.filter(u => filter==='all' ? true : (u.employment || 'full-time') === filter)
  const list = document.getElementById('list')

  if (!data.length) {
    list.innerHTML = '<div class="empty">無資料</div>'
    return
  }

  list.innerHTML = data.map(u => {
    const yrs = calcSeniorityYears(u.hireDate)
    const { quota, used, left } = remaining(u)
    const isFT = (u.employment || 'full-time') === 'full-time'
    return `
      <div class="row">
        <div class="cell">${u.nickname || '(無暱稱)'}</div>
        <div class="cell">${u.email || ''}</div>
        <div class="cell">${u.group || ''}</div>
        <div class="cell"><span class="badge ${u.employment||'full-time'}">${labelEmployment(u.employment)}</span></div>
        <div class="cell">${u.hireDate || '未設定'}（年資：${yrs} 年）</div>
        <div class="cell">剩餘 ${left} 天 / 總額 ${quota} 天（已用 ${used} 天）</div>
        <div class="cell actions">
          <select data-id="${u.id}">
            ${opt('full-time','正職',u.employment)}
            ${opt('part-time','兼職',u.employment)}
            ${opt('resigned','離職',u.employment)}
          </select>
          ${isFT ? `
            <button data-action="hire"  data-id="${u.id}">入職日</button>
            <button data-action="quota" data-id="${u.id}">年假</button>
          ` : `<span class="muted">非正職無年假</span>`}
          <button data-action="reset" data-id="${u.id}" data-email="${u.email||''}">寄重設信</button>
        </div>
      </div>`
  }).join('')
}
