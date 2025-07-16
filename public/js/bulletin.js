// bulletin.js
import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const groupMap = {
  '外場': '📌 外場',
  '內場': '📌 內場',
  '出貨': '📌 出貨',
  '美編': '📌 美編',
  '行銷': '📌 行銷'
}

const getNDaysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

window.onload = async () => {
  const toolbar = document.querySelector('.date-toolbar')
  const picker = document.getElementById('datePicker')
  const buttons = {
    'prev-day': 1,
    'prev-3days': 3,
    'prev-week': 7,
    'prev-month': 30
  }

  for (const id in buttons) {
    document.getElementById(id)?.addEventListener('click', () => {
      const date = getNDaysAgo(buttons[id])
      renderBulletins(date)
    })
  }

  picker?.addEventListener('change', () => {
    const selected = new Date(picker.value)
    selected.setHours(0, 0, 0, 0)
    renderBulletins(selected)
  })

  renderBulletins(getNDaysAgo(3))
}

async function renderBulletins(minDate) {
  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const grouped = {}

  snapshot.forEach(doc => {
    const d = doc.data()
    const created = d.createdAt?.toDate?.()
    if (!created || created < minDate) return
    const groups = d.visibleTo || ['未分類']
    const content = d.content?.join?.('\n') || ''
    const nickname = d.nickname || '匿名'
    groups.forEach(group => {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(`🔹 <strong>${nickname}</strong>: ${content}`)
    })
  })

  const container = document.getElementById('bulletin-board')
  container.innerHTML = ''
  Object.keys(grouped).forEach((group, i) => {
    const section = document.createElement('div')
    section.className = 'group-block'
    const h3 = document.createElement('h3')
    h3.textContent = groupMap[group] || `📌 ${group}`
    section.appendChild(h3)
    grouped[group].forEach(msg => {
      const p = document.createElement('p')
      p.innerHTML = msg
      section.appendChild(p)
    })
    container.appendChild(section)
  })
}
