
import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const groupMap = {
  '外場': '外場', '內場': '內場',
  '出貨': '出貨', '美編': '美編',
  '行銷': '行銷'
}

window.onload = async () => {
  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const grouped = {}

  snapshot.forEach(doc => {
    const d = doc.data()
    const targets = d.visibleTo || ['未分類']
    targets.forEach(group => {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push({ nickname: d.nickname, content: d.content })
    })
  })

  const container = document.getElementById('bulletin-board')
  container.innerHTML = '<div class="columns"><div class="col"></div><div class="col"></div></div>'
  const cols = container.querySelectorAll('.col')
  const keys = Object.keys(grouped)
  keys.forEach((group, index) => {
    const box = document.createElement('div')
    box.className = 'group-box group-' + group
    const title = document.createElement('div')
    title.className = 'group-title'
    title.textContent = groupMap[group] || group
    box.appendChild(title)

    grouped[group].forEach(item => {
      const msg = document.createElement('div')
      msg.className = 'msg-line'
      msg.innerHTML = `<strong>${item.nickname}</strong>:<br>${item.content.replaceAll('\n', '<br>')}`
      box.appendChild(msg)
    })

    cols[index % 2].appendChild(box)
  })
}
