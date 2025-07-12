import { db } from '/js/firebase.js'
import {
  collection, getDocs, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const tableBody = document.getElementById('repair-tbody')

const stateIcons = {
  '1': '<span class="repair-icon-btn">🆕</span>',
  '2': '<span class="repair-icon-btn">🚚</span>',
  '3': '<span class="repair-icon-btn">🚚</span>',
  '4': '<span class="repair-icon-btn">🆗</span>',
}

const loadRepairs = async () => {
  const querySnapshot = await getDocs(collection(db, 'repairs'))
  tableBody.innerHTML = ''
  querySnapshot.forEach(docSnap => {
    const data = docSnap.data()
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${data.repairId}</td>
      <td>${data.customerName || ''}</td>
      <td>${data.product || ''}</td>
      <td>${data.description || ''}</td>
      <td>${stateIcons[data.status] || ''}</td>
      <td><button class="repair-icon-btn" onclick="console.log('下一步')">➡️</button></td>
    `
    tableBody.appendChild(tr)
  })
}

window.onload = loadRepairs
