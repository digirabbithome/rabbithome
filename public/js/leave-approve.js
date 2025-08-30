import { db, auth } from '/js/firebase.js'
import {
  collectionGroup, getDocs, getDoc, doc, writeBatch, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// === 管理者白名單 ===
const ADMINS = ['swimming8250@yahoo.com.tw', 'duckskin@yahoo.com.tw']

// === TPE（GMT+8）安全日期工具 ===
const pad2 = n => String(n).padStart(2, '0')
const fmtYMD_TPE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
})
const fmtHMS_TPE = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
})
const nowTPE = () => `${fmtYMD_TPE.format(new Date())} ${fmtHMS_TPE.format(new Date())}`

// 以「本地午夜」展開 (避免 UTC 偏移造成差一天)
const expandDates = (startYMD, endYMD) => {
  const out = []
  const s = new Date(`${startYMD}T00:00:00`)
  const e = new Date(`${endYMD}T00:00:00`)
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(fmtYMD_TPE.format(d))
  }
  return out
}

const statusCN = s => (s === 'approved' ? '已核准' : s === 'rejected' ? '已拒絕' : '待審核')

// === 入口 ===
window.onload = () => {
  onAuthStateChanged(auth, async me => {
    if (!me) { alert('請先登入'); return }
    if (!ADMINS.includes(me.email || '')) { alert('沒有權限'); location.replace('/user-manage-v2.html'); return }
    bindUI(); await refresh()
  })
}

function bindUI() {
  document.getElementById('refresh').onclick = refresh
  // 預設查當月
  const now = new Date()
  const y = now.getFullYear(), m = pad2(now.getMonth() + 1)
  document.getElementById('from').value = `${y}-${m}-01`
  document.getElementById('to').value = `${y}-${m}-${new Date(y, parseInt(m), 0).getDate()}`
}

async function refresh() {
  const list = document.getElementById('list')
  list.innerHTML = '載入中…'

  const statusSel = document.getElementById('status').value
  const from = document.getElementById('from').value
  const to = document.getElementById('to').value
  const allowOverrideChecked = document.getElementById('allowOverride')?.checked || false

  // 直接用 collectionGroup 抓所有 leaves（避免逐一列出所有 users 再各抓）
  const allSnap = await getDocs(collectionGroup(db, 'leaves'))
  list.innerHTML = ''

  for (const d of allSnap.docs) {
    const l = d.data() || {}
    const uid = d.ref.parent.parent.id
    if (statusSel !== 'all' && l.status !== statusSel) continue
    if (!l.start || !l.end) continue

    const dates = expandDates(l.start, l.end)
    const inRange = (!from && !to) || dates.some(dd => (!from || dd >= from) && (!to || dd <= to))
    if (!inRange) continue

    // 讀取 user profile 以顯示 Name / Email 與計算年度配額
    const uSnap = await getDoc(doc(db, 'users', uid))
    const u = uSnap.exists() ? uSnap.data() : {}
    const name = u.nickname || u.name || '(未命名)'
    const email = u.email || ''

    // 計算 quota/used/left（以台北時間年度為準）
    const year = Number(fmtYMD_TPE.format(new Date()).slice(0, 4))
    const policy = u.annualLeavePolicy || {}
    const stats = (u.leaveStats?.year === year) ? u.leaveStats : { approvedTaken: 0 }
    const eff = policy.effectiveFrom ? new Date(`${policy.effectiveFrom}T00:00:00`) : null
    const quota = (eff && new Date() < eff) ? 0 : (
      Number(policy.baseDays || 0) + Number(policy.carryOverDays || 0) + Number(policy.manualAdjust || 0)
    )
    const used = Number(stats.approvedTaken || 0)
    const left = Math.max(0, quota - used)

    const days = l.days || dates.length

    // 列表 row
    const row = document.createElement('div')
    row.className = 'row'
    row.innerHTML = `
      <span>${name}</span>
      <span>${email}</span>
      <span>${l.start} ~ ${l.end}</span>
      <span>${days}</span>
      <span>${l.type === 'annual' ? '年假' : (l.type || '-')}</span>
      <span><span class="badge ${l.status}">${statusCN(l.status)}</span></span>
      <span>${left}/${quota}</span>
      <span class="actions">${
        l.status === 'pending'
          ? `<button data-act="approve" data-allow="${allowOverrideChecked ? '1' : '0'}" data-path="${d.ref.path}">核准</button>
             <button data-act="reject" class="secondary" data-path="${d.ref.path}">拒絕</button>`
          : '<small class="muted">已完結</small>'
      }</span>`
    list.appendChild(row)
  }

  // 綁定核准/拒絕
  list.onclick = async e => {
    const btn = e.target.closest('button[data-act]')
    if (!btn) return

    const ref = doc(db, btn.dataset.path)
    const snap = await getDoc(ref)
    if (!snap.exists()) return alert('申請不存在')

    const leave = snap.data() || {}
    const uid = ref.parent.parent.id

    if (btn.dataset.act === 'reject') {
      await updateDoc(ref, {
        status: 'rejected',
        rejectedAtTPE: nowTPE(),
        approver: auth.currentUser?.uid || null
      })
      return refresh()
    }

    if (btn.dataset.act === 'approve') {
      const allowOverride = btn.dataset.allow === '1'

      // 讀 user 配額
      const uRef = doc(db, 'users', uid)
      const uSnap = await getDoc(uRef)
      const u = uSnap.exists() ? uSnap.data() : {}

      const year = Number(fmtYMD_TPE.format(new Date()).slice(0, 4))
      const policy = u.annualLeavePolicy || {}
      const stats = (u.leaveStats?.year === year) ? u.leaveStats : { approvedTaken: 0 }
      const eff = policy.effectiveFrom ? new Date(`${policy.effectiveFrom}T00:00:00`) : null
      const quota = (eff && new Date() < eff) ? 0 : (
        Number(policy.baseDays || 0) + Number(policy.carryOverDays || 0) + Number(policy.manualAdjust || 0)
      )
      const used = Number(stats.approvedTaken || 0)
      const left = Math.max(0, quota - used)

      const dates = expandDates(leave.start, leave.end)
      const days = leave.days || dates.length

      if (leave.type === 'annual' && days > left) {
        if (!allowOverride) {
          alert(`此員工年假剩餘 ${left} 天，不足以核准 ${days} 天。\n(可勾選「允許剩餘不足仍可核准」後重試)`) 
          return
        }
        const ok = confirm(`此員工年假剩餘 ${left} 天，不足以核准 ${days} 天。\n是否仍要超扣核准？`)
        if (!ok) return
      }

      const batch = writeBatch(db)

      // 寫 schedules/{uid}/{yyyymm}/{dd}
      let idx = 0
      for (const ds of dates) {
        idx += 1
        const yyyymm = ds.slice(0, 7).replace('-', '')
        const dd = ds.slice(8, 10)
        const dayRef = doc(db, 'schedules', uid, yyyymm, dd)
        const human = leave.type === 'annual' ? '年假' : (leave.type || '假')

        // 年假才寫入這三個（供 attendance.js 顯示 n/N）
        const annualUsedSoFar = leave.type === 'annual' ? (used + idx) : null
        const annualTotalQuota = leave.type === 'annual' ? quota : null
        const annualLabel = leave.type === 'annual' ? `${human}${annualUsedSoFar}/${annualTotalQuota}` : null

        batch.set(dayRef, {
          dateYMD: ds,                    // 明確寫台北切日字串，避免日界線問題
          leaveType: leave.type,          // 'annual' | 'personal' | ...
          leaveIndex: idx,                // 這一段落的第幾天
          leaveTotal: days,               // 總天數
          leaveLabel: `${human}${idx}/${days}`,
          annualUsedSoFar,
          annualTotalQuota,
          annualLabel,
          requiredHoursOverride: 0,       // 假日 = 0 小時
          fromQuota: leave.type === 'annual',
          markedBy: auth.currentUser?.uid || null,
          markedAtTPE: nowTPE()
        }, { merge: true })
      }

      // 回寫申請單狀態
      batch.update(ref, {
        status: 'approved',
        approvedAtTPE: nowTPE(),
        approver: auth.currentUser?.uid || null
      })

      // 更新年度累計
      if (leave.type === 'annual') {
        const cur = (stats && stats.year === year) ? Number(stats.approvedTaken || 0) : 0
        batch.update(doc(db, 'users', uid), {
          leaveStats: { year, approvedTaken: cur + days }
        })
      }

      await batch.commit()
      alert('已核准並同步到班表')
      return refresh()
    }
  }
}
