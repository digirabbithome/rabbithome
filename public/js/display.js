
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'
import {
  getFirestore, collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const firebaseConfig = {
  apiKey: "test", authDomain: "test.firebaseapp.com",
  projectId: "test-id", storageBucket: "test.appspot.com",
  messagingSenderId: "000000000", appId: "1:test:web:test"
}
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const groupMap = {
  '外場': '📌 外場', '內場': '📌 內場',
  '出貨': '📌 出貨', '美編': '📌 美編',
  '行銷': '📌 行銷', '系統': '📌 系統'
}

window.onload = async () => {
  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const grouped = {}

  snapshot.forEach(doc => {
    const d = doc.data()
    const lines = d.content?.join?.('<br>') || ''
    const targets = d.visibleTo || ['未知']
    targets.forEach(group => {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push({ nickname: d.createdBy, lines })
    })
  })

  const container = document.getElementById('bulletin-board')
  Object.keys(grouped).forEach(group => {
    const groupTitle = groupMap[group] || `📌 ${group}`
    const section = document.createElement('div')
    section.className = 'group-block'
    section.innerHTML = `<h3>${groupTitle}</h3>`
    grouped[group].forEach(msg => {
      const entry = `<div class="msg-line">🔹 <strong>${msg.nickname}</strong>: ${msg.lines}</div>`
      section.innerHTML += entry
    })
    container.appendChild(section)
  })
}
