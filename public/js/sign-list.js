
import { db } from '/js/firebase.js'
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

function renderTable(data) {
  const list = document.getElementById('sign-list')
  list.innerHTML = ''
  data.forEach(doc => {
    const d = doc.data()
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${d.createdAt?.toDate().toLocaleDateString()}</td>
      <td>${d.type2}</td>
      <td>${d.note}</td>
      <td>${d.amount}</td>
      <td>${d.nickname}</td>
      <td><img src="${d.signatureUrl || ''}" width="60"/></td>
    `
    list.appendChild(row)
  })
}

window.onload = () => {
  document.getElementById('monthSearchBtn').addEventListener('click', async () => {
    const year = parseInt(document.getElementById('yearSelect').value)
    const month = parseInt(document.getElementById('monthSelect').value) - 1 // JS 月份從 0 開始
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 1)

    const q = query(collection(db, 'signs'),
                    where('createdAt', '>=', startDate),
                    where('createdAt', '<', endDate))
    const snapshot = await getDocs(q)
    renderTable(snapshot.docs)
  })
}
