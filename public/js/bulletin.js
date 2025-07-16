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
  const q = query(collection(db, 'bulletin'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const grouped = {}

  snapshot.forEach(doc => {
    const d = doc.data()
    const lines = d.content.split('\n').filter(line => line.trim() !== '')
    const group = d.targetGroup || '未分類'
    if (!grouped[group]) grouped[group] = []
    grouped[group].push({ nickname: d.nickname, lines })
  })

  const container = document.getElementById('bulletin-board')
  Object.keys(grouped).forEach(group => {
    const groupTitle = groupMap[group] || `📌 ${group}`
    const section = document.createElement('div')
    section.innerHTML = `<h3>${groupTitle}</h3>`

    grouped[group].forEach(msg => {
      msg.lines.forEach(line => {
        const entry = `<div class="msg-line">🔹 <strong>${msg.nickname}</strong>: ${line}</div>`
        section.innerHTML += entry
      })
    })

    container.appendChild(section)
  })
}
