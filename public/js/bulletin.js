
import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const groupMap = {
  '外場': '📌 外場',
  '內場': '📌 內場',
  '出貨': '📌 出貨',
  '美編': '📌 美編',
  '行銷': '📌 行銷'
}

const pastelColors = ['#ff88aa', '#a3d8ff', '#fff2a3', '#e4d8d8', '#c8facc']
let currentRangeDays = 3
let allDocs = []

window.onload = async () => {
  const now = new Date()
  document.getElementById('datePicker').value = now.toISOString().split('T')[0]

  document.getElementById('prev-day').addEventListener('click', () => updateRange(1))
  document.getElementById('prev-3days').addEventListener('click', () => updateRange(3))
  document.getElementById('prev-week').addEventListener('click', () => updateRange(7))
  document.getElementById('prev-month').addEventListener('click', () => updateRange(30))
  document.getElementById('datePicker').addEventListener('change', (e) => {
    const selected = new Date(e.target.value)
    renderBulletins(selected, 1)
  })

  document.getElementById('searchBox').addEventListener('input', () => {
    renderBulletins(new Date(), currentRangeDays)
  })

  await preloadAllDocsWithinOneYear()
  renderBulletins(new Date(), currentRangeDays)
}

async function preloadAllDocsWithinOneYear() {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  allDocs = []
  snapshot.forEach(docSnap => {
    const d = docSnap.data()
    const createdAt = d.createdAt?.toDate?.()
    if (!createdAt || createdAt < oneYearAgo) return
    d._id = docSnap.id
    d._createdAt = createdAt
    allDocs.push(d)
  })
}

function updateRange(days) {
  currentRangeDays = days
  renderBulletins(new Date(), days)
}

async function renderBulletins(endDate, rangeDays) {
  const container = document.getElementById('bulletin-board')
  container.innerHTML = ''

  const dateStr = endDate.toISOString().split('T')[0]
  const titleEl = document.getElementById('date-title')
  titleEl.textContent = `📌 公布欄：${dateStr}（往前${rangeDays}天）`

  const endDateFull = new Date(endDate)
  endDateFull.setHours(23, 59, 59, 999)

  const startDate = new Date(endDateFull)
  startDate.setDate(startDate.getDate() - (rangeDays - 1))
  startDate.setHours(0, 0, 0, 0)

  const keyword = document.getElementById('searchBox')?.value.trim().toLowerCase() || ''

  const filtered = allDocs.filter(d => {
    if (!d._createdAt || d._createdAt < startDate || d._createdAt > endDateFull) return false
    if (!keyword) return true
    const content = (d.content || []).join(' ').toLowerCase()
    const name = (d.createdBy || d.nickname || '').toLowerCase()
    return content.includes(keyword) || name.includes(keyword)
  })

  const grouped = {}
  filtered.forEach(d => {
    const targets = d.visibleTo || ['未知']
    const contentList = d.content?.join?.('\n') || ''
    const nickname = d.createdBy || d.nickname || '匿名者'
    const displayText = nickname + '：' + contentList

    targets.forEach(group => {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push({ text: displayText, id: d._id, isStarred: d.isStarred })
    })
  })

  let colorIndex = 0
  for (const group in grouped) {
    const groupDiv = document.createElement('div')
    groupDiv.className = 'group-block'
    const title = document.createElement('h3')
    title.textContent = groupMap[group] || group
    title.style.backgroundColor = pastelColors[colorIndex % pastelColors.length]
    colorIndex++

    groupDiv.appendChild(title)

    grouped[group].forEach(({ text, id, isStarred }) => {
      const p = document.createElement('p')

      const star = document.createElement('span')
      star.textContent = isStarred ? '⭐' : '☆'
      star.style.cursor = 'pointer'
      star.style.marginRight = '0.5rem'
      star.addEventListener('click', async () => {
        const newStatus = star.textContent === '☆'
        star.textContent = newStatus ? '⭐' : '☆'
        const ref = doc(db, 'bulletins', id)
        await updateDoc(ref, { isStarred: newStatus })
      })

      p.appendChild(star)
      p.appendChild(document.createTextNode(text))
      groupDiv.appendChild(p)
    })

    container.appendChild(groupDiv)
  }
}
