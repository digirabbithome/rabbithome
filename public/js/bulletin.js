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

window.onload = async () => {
  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const grouped = {}

  snapshot.forEach(doc => {
    const d = doc.data()
    const targets = d.visibleTo || ['未知']
    const content = d.content?.join?.('\n') || ''

    targets.forEach(group => {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(content)
    })
  })

  const container = document.getElementById('bulletin-board')
  for (const group in grouped) {
    const groupDiv = document.createElement('div')
    groupDiv.className = 'group-block'
    const title = document.createElement('h3')
    title.textContent = groupMap[group] || group
    groupDiv.appendChild(title)

    grouped[group].forEach(content => {
      const p = document.createElement('p')
      p.textContent = content
      groupDiv.appendChild(p)
    })

    container.appendChild(groupDiv)
  }
}
