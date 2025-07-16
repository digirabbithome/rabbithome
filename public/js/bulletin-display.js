import { db } from '/js/firebase.js'
import {
  collection, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const listDiv = document.getElementById('bulletin-list')

async function render() {
  const snapshot = await getDocs(query(collection(db, 'bulletins'), orderBy('createdAt', 'desc')))
  if (snapshot.empty) {
    listDiv.innerHTML = '<p>目前沒有公告。</p>'
    return
  }

  const html = []
  snapshot.forEach(doc => {
    const d = doc.data()
    const time = d.createdAt?.toDate?.().toLocaleString?.() || '（時間不明）'
    html.push(`
      <div style="border:1px solid #ccc; padding:10px; margin:10px 0;">
        <strong>${d.title}</strong><br>
        <em>${time} by ${d.createdBy || '未知'}</em><br>
        <div>${(d.content || []).map(c => `<p>${c}</p>`).join('')}</div>
        <small>👁️ 可見：${(d.visibleTo || []).join(', ')}</small>
      </div>
    `)
  })
  listDiv.innerHTML = html.join('')
}

render()
