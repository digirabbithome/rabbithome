import { db } from '/js/firebase.js'
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, where
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let pickupList = []

// 🕒 台北時區時間格式（顯示取貨時間用）
const timeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: TPE,
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})



window.onload = async () => {
  document.getElementById('addBtn').addEventListener('click', addPickup)
  document.getElementById('search').addEventListener('input', renderList)
  document.getElementById('showFormBtn').addEventListener('click', () => {
    document.getElementById('form-area').style.display = 'block'
    document.getElementById('list-area').style.display = 'none'
  })
  document.getElementById('cancelFormBtn').addEventListener('click', () => {
    document.getElementById('form-area').style.display = 'none'
    document.getElementById('list-area').style.display = 'block'
  })

  // 🆕 本日已取貨按鈕
  const todayBtn = document.getElementById('todayDoneBtn')
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      // 清空搜尋，避免被關鍵字影響
      const search = document.getElementById('search')
      if (search) search.value = ''
      renderTodayDone()
    })
  }

  await fetchData()
  renderList()

  document.addEventListener('click', e => {
    if (!e.target.classList.contains('print-link')) return
    const id = e.target.dataset.id
    const data = pickupList.find(p => p.id === id)
    if (!data) return

    const area = document.getElementById('print-area')
    area.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <img src="img/logo-black.png" style="height: 48px;" />
        <div style="font-size: 40px; font-weight: bold;">${data.serial || ''}</div>
      </div>
      <hr style="margin: 20px 0; border-top: 2px solid #000;" />
      <h2 style="text-align: center; margin-bottom: 24px;">數位小兔取貨單</h2>
      <p><strong>取貨人：</strong>${data.contact || ''}</p>
      <p><strong>商品：</strong><span style="white-space:pre-line;">${data.product || ''}</span></p>
      <p><strong>備註：</strong><span style="white-space:pre-line;">${data.note || '—'}</span>（${data.paid || '—'}）</p>
      <p><strong>服務業務：</strong>${data.createdBy || ''}</p>
    `
    document.getElementById('list-area').style.display = 'none'
    area.style.display = 'block'
    window.print()
    area.style.display = 'none'
    document.getElementById('list-area').style.display = 'block'
  })

  // 內嵌編輯：商品／備註
  document.addEventListener('click', (e) => {
    const t = e.target
    if (!t.classList.contains('editable')) return
    if (t.dataset.editing === '1') return
    t.dataset.editing = '1'

    const id = t.dataset.id
    const field = t.dataset.field // 'product' | 'note'
    const original = t.textContent.trim()

    const ta = document.createElement('textarea')
    ta.value = original
    ta.style.width = '100%'
    ta.style.minHeight = field === 'note' ? '48px' : '32px'
    ta.style.fontSize = '14px'
    ta.style.borderRadius = '6px'
    ta.style.border = '1px solid #ccc'
    ta.style.padding = '6px'
    ta.style.boxSizing = 'border-box'

    t.innerHTML = ''
    t.appendChild(ta)
    ta.focus()
    ta.select()

    ta.addEventListener('keydown', (ev) => {
      if (field === 'product' && ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault()
        ta.blur()
      }
    })

    ta.addEventListener('blur', async () => {
      const newVal = ta.value.trim()
      try {
        if (newVal !== original) {
          await saveEdit(id, field, newVal)
          const idx = pickupList.findIndex(p => p.id === id)
          if (idx >= 0) pickupList[idx][field] = newVal
        }
        t.textContent = newVal || (field === 'note' ? '—' : '')
      } catch (err) {
        console.error('update failed', err)
        t.textContent = original
        alert('更新失敗，請再試一次')
      } finally {
        t.dataset.editing = '0'
      }
    })
  })

  // 📌 設為完成 → 灰底（預設不顯示已完成；搜尋時才會顯示）
  document.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('pin-toggle')) return
    const id = e.target.dataset.id
    if (!id) return
    const nickname = localStorage.getItem('nickname') || '未登入'
    const ref = doc(db, 'pickups', id)
    await updateDoc(ref, {
      pinStatus: 1,
      doneBy: nickname,
      doneAt: serverTimestamp()    // 🆕 取貨完成時間
    })
    const item = pickupList.find(p => p.id === id)
    if (item) {
      item.pinStatus = 1
      item.doneBy = nickname
      // 前端暫時用現在時間，等下次 reload 會以 serverTimestamp 為準
      item.doneAt = { toDate: () => new Date() }
    }
    renderList()
  })
}

// === Firestore 讀取：三個月內 ===
async function fetchData() {
  const now = new Date()
  const since = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  const q = query(
    collection(db, 'pickups'),
    where('createdAt', '>=', since),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  pickupList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

// 共用排序：付款狀態優先，其次建立時間（一般列表用）
function comparePickup(a, b) {
  const priority = { '未付款': 1, '已付訂金': 2, '已付全額': 3 }
  const p1 = priority[a.paid] || 99
  const p2 = priority[b.paid] || 99
  if (p1 !== p2) return p1 - p2
  const t1 = a.createdAt?.toDate?.() || new Date(0)
  const t2 = b.createdAt?.toDate?.() || new Date(0)
  return t2 - t1
}

// 🆕 排序：依照取貨完成時間 doneAt（今日已取貨用）
function compareByDoneTime(a, b) {
  const t1 = a.doneAt?.toDate?.() || new Date(0)
  const t2 = b.doneAt?.toDate?.() || new Date(0)
  return t2 - t1   // 新 → 舊
}

// 建卡片（一般列表 & 本日已取貨共用）
function createPickupCard(p) {
  // 底色
  let bgColor = '#fff9b1'
  if (p.paid === '已付訂金') bgColor = '#d0f0ff'
  if (p.paid === '已付全額') bgColor = '#d9f7c5'

  // 超過14天未取 → 紅
  const now = new Date()
  const createdAt = p.createdAt?.toDate?.() || new Date(0)
  const dayDiff = (now - createdAt) / (1000 * 60 * 60 * 24)
  if (dayDiff > 14) bgColor = '#ffb1b1'

  // 已取走 → 灰（搜尋時或「本日已取貨」中出現）
  if (p.pinStatus === 1) bgColor = '#e0e0e0'

  // 🕒 取貨時間文字（有 doneAt 才顯示）
  let doneTimeText = ''
  if (p.doneAt?.toDate) {
    const d = p.doneAt.toDate()
    doneTimeText = timeFormatter.format(d)
  }

  const div = document.createElement('div')
  div.className = 'pickup-card'
  div.style.backgroundColor = bgColor
  div.innerHTML = `
    <div style="font-weight: bold; font-size: 16px; border-bottom: 1px solid #999; padding-bottom: 4px; margin-bottom: 4px;">
      <span class="pin-toggle" data-id="${p.id}" style="cursor:pointer;">📌</span>&nbsp;
      ${p.serial || "—"}&nbsp;&nbsp;&nbsp;
      <span class="print-link" data-id="${p.id}" style="cursor:pointer; text-decoration: underline;">
        ${p.contact || "未填寫"}
      </span>
    </div>
    <div>
      商品：
      <span class="editable multiline" data-id="${p.id}" data-field="product" style="cursor:text; border-bottom: 1px dashed #666;">
        ${p.product || ''}
      </span>
    </div>
    <small>
      <span class="editable multiline" data-id="${p.id}" data-field="note" style="cursor:text; border-bottom: 1px dashed #999;">
        ${p.note || '—'}
      </span>
      （${p.paid || '—'}）(${p.createdBy || ''})
    </small>
    ${doneTimeText
       ? `<div style="margin-top:4px; font-size:12px; color:#e85b81; font-weight:700;">
       取貨時間：${doneTimeText}
     </div>`
  : ''
    }
  `
  return div
}

// 一般列表：預設只顯示未完成，搜尋可搜到已完成
function renderList() {
  const kwRaw = document.getElementById('search').value || ''
  const kw = kwRaw.trim().toLowerCase()
  const isSearching = kw.length > 0

  const list = document.getElementById('pickup-list')
  list.innerHTML = ''

  pickupList.sort(comparePickup)

  pickupList.forEach(p => {
    // 預設（非搜尋狀態）→ 只顯示未完成
    if (!isSearching && p.pinStatus === 1) return

    // 搜尋比對
    if (isSearching) {
      const match = [p.serial, p.contact, p.product, p.note, p.createdBy]
        .some(v => (v || '').toLowerCase().includes(kw))
      if (!match) return
    }

    list.appendChild(createPickupCard(p))
  })
}

// 🆕 本日已取貨（依照 doneBy 分區 + 中間有名字 + 頭像，卡片依 doneAt 排序）
function renderTodayDone() {
  const list = document.getElementById('pickup-list')
  list.innerHTML = ''

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  // 取得今天完成的訂單
  const todayDone = pickupList.filter(p => {
    if (p.pinStatus !== 1) return false
    const doneAt = p.doneAt?.toDate?.()
    if (!doneAt) return false
    return doneAt >= start && doneAt < end
  })

  if (todayDone.length === 0) {
    list.innerHTML = '<p style="padding:20px; color:#666;">今日尚無取貨完成紀錄</p>'
    return
  }

  // 🧑‍🎨 頭像對照表（你可以之後再補更多）
  const avatarMap = {
    '花花': '👩‍🦰',
    '妹妹': '🧑‍🧑‍🧒',
    '阿寶': '🧑‍🔧',
    'Laura': '👩‍💼',
    'Hank': '🧑‍💼',
    '小E': '🧑‍💻',
    '億芯': '👨‍🔧',
    '未標註': '👤'
  }

  // 依 doneBy 分組
  const groups = {}
  todayDone.forEach(p => {
    const name = p.doneBy || '未標註'
    if (!groups[name]) groups[name] = []
    groups[name].push(p)
  })

  const sortedNames = Object.keys(groups).sort()

  sortedNames.forEach(name => {

    const avatar = avatarMap[name] || '👤' // 預設沒有找到用👤

    // ─────── 名稱區塊（含頭像）───────
    const divider = document.createElement('div')
    divider.style.display = 'flex'
    divider.style.alignItems = 'center'
    divider.style.margin = '25px 0 12px'
    divider.style.gridColumn = '1 / -1'   // 分隔線橫跨整排
    divider.innerHTML = `
      <div style="flex:1; height:1px; background:#ccc;"></div>
      <span style="padding:0 12px; color:#333; font-weight:600; white-space:nowrap; font-size:18px;">
        ${avatar} ${name}
      </span>
      <div style="flex:1; height:1px; background:#ccc;"></div>
    `
    list.appendChild(divider)

    // 卡片：依完成時間排序（新 → 舊）
    groups[name].sort(compareByDoneTime).forEach(p => {
      list.appendChild(createPickupCard(p))
    })
  })
}

async function addPickup() {
  const contact = document.getElementById('contact').value.trim()
  const product = document.getElementById('product').value.trim()
  const note = document.getElementById('note').value.trim()
  const paid = document.getElementById('paid').value
  const nickname = localStorage.getItem('nickname') || '未登入使用者'

  if (!contact && !product) return alert('⚠️ 請至少填寫聯絡資訊或商品內容')

  const serial = await generateSerial()

  await addDoc(collection(db, 'pickups'), {
    createdAt: serverTimestamp(),
    pinStatus: 0,
    contact, product, note, paid,
    createdBy: nickname,
    serial
  })

  document.getElementById('contact').value = ''
  document.getElementById('product').value = ''
  document.getElementById('note').value = ''

  document.getElementById('form-area').style.display = 'none'
  document.getElementById('list-area').style.display = 'block'

  await fetchData()
  renderList()
}

async function generateSerial() {
  const now = new Date()
  const mmdd = (now.getMonth() + 1).toString().padStart(2, '0') +
               now.getDate().toString().padStart(2, '0')
  const hh = now.getHours().toString().padStart(2, '0')
  const min = now.getMinutes().toString().padStart(2, '0')
  return mmdd + hh + min
}

async function saveEdit(id, field, value) {
  const ref = doc(db, 'pickups', id)
  await updateDoc(ref, { [field]: value, updatedAt: serverTimestamp() })
}
