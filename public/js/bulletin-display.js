import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

function renderGroupedBulletins(grouped) {
  const board = document.getElementById('bulletin-board')
  board.innerHTML = ''

  const groupOrder = ['外場', '內場', '美編', '出貨', '行銷']
  groupOrder.forEach(group => {
    const posts = grouped[group]
    if (!posts || posts.length === 0) return

    const groupDiv = document.createElement('div')
    groupDiv.innerHTML = `<h3>📌 ${group}</h3>`
    posts.forEach(post => {
      const lines = post.content.map(line => `🔹 ${post.createdBy}: ${line}`).join('<br>')
      const div = document.createElement('div')
      div.innerHTML = lines + '<br><br>'
      groupDiv.appendChild(div)
    })
    board.appendChild(groupDiv)
  })
}

window.onload = async () => {
  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const data = snapshot.docs.map(doc => doc.data())

  // 依群組分組
  const grouped = {}
  data.forEach(post => {
    const visibleTo = post.visibleTo || []
    visibleTo.forEach(group => {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(post)
    })
  })

  renderGroupedBulletins(grouped)
}
