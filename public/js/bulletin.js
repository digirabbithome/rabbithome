
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

const groupOrder = ['外場', '內場', '出貨', '美編', '行銷', '未分類']

window.onload = async () => {
  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const grouped = {}

  snapshot.forEach(doc => {
    const d = doc.data()
    const group = d.group || '未分類'
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(d)
  })

  const container = document.getElementById('bulletin-board')
  groupOrder.forEach(group => {
    if (!grouped[group]) return
    const groupDiv = document.createElement('div')
    groupDiv.className = 'group-block'
    const title = document.createElement('h3')
    title.textContent = groupMap[group] || group
    groupDiv.appendChild(title)

    grouped[group].forEach(item => {
      const p = document.createElement('p')
      p.textContent = Array.isArray(item.content)
        ? item.content.join('\n')
        : item.content || ''
      groupDiv.appendChild(p)
    })

    container.appendChild(groupDiv)
  })
}
