
import { db } from '/js/firebase.js'
import {
  collection, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let suppliers = []
let selectedSupplier = ''

window.onload = async () => {
  const snapshot = await getDocs(collection(db, 'suppliers'))
  suppliers = snapshot.docs.map(doc => doc.data()).filter(d => d.id && d.name)

  const searchBox = document.getElementById('supplierSearch')
  const resultList = document.getElementById('supplierResults')

  searchBox.addEventListener('input', () => {
    const keyword = searchBox.value.trim().toLowerCase()
    resultList.innerHTML = ''

    const results = suppliers.filter(d =>
      d.id.startsWith(keyword) || d.name.includes(keyword)
    )

    results.forEach(d => {
      const li = document.createElement('li')
      li.textContent = `${d.id} - ${d.name}`
      resultList.appendChild(li)
    })
  })
}
