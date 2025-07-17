
import { db } from '/js/firebase.js'
import {
  collection, getDocs, doc, getDoc, updateDoc, setDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const nickname = localStorage.getItem('nickname') || '匿名者'

function convertText(text) {
  return text
    .replace(/\[yellow\](.*?)\[\/yellow\]/g, '<span class="highlight-yellow">$1</span>')
    .replace(/\[pink\](.*?)\[\/pink\]/g, '<span class="highlight-pink">$1</span>')
    .replace(/\[strike\](.*?)\[\/strike\]/g, '<span class="strike-through">$1</span>')
}

function createIcon(type, filled = false) {
  const icon = document.createElement('span')
  icon.className = 'icon-btn'
  icon.innerHTML = type === 'star'
    ? (filled ? '⭐' : '☆')
    : (type === 'edit' ? '✏️' : '')
  return icon
}

async function fetchBulletins(dateStr) {
  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const list = []
  snapshot.forEach(doc => {
    const d = doc.data()
    d.id = doc.id
    if (!d.archived && (!dateStr || d.date === dateStr)) list.push(d)
  })
  return list
}

function renderBulletin(bulletin, container) {
  const card = document.createElement('div')
  card.className = 'bulletin-card'
  if (bulletin.highlight) card.classList.add('highlight')

  const title = document.createElement('h3')
  title.innerHTML = convertText(bulletin.title)
  card.appendChild(title)

  const content = document.createElement('p')
  content.innerHTML = convertText(bulletin.content)
  card.appendChild(content)

  const meta = document.createElement('div')
  meta.className = 'bulletin-meta'
  meta.innerText = `${bulletin.createdBy} · ${bulletin.date}`
  card.appendChild(meta)

  const iconRow = document.createElement('div')
  iconRow.className = 'icon-row'

  // 星星收藏功能
  const star = createIcon('star', bulletin.starred)
  star.onclick = async () => {
    bulletin.starred = !bulletin.starred
    await updateDoc(doc(db, 'bulletins', bulletin.id), { starred: bulletin.starred })
    loadBulletins()
  }
  iconRow.appendChild(star)

  // 鉛筆黃底功能
  const edit = createIcon('edit')
  edit.onclick = async () => {
    if (!bulletin.highlight) {
      bulletin.highlight = true
      await updateDoc(doc(db, 'bulletins', bulletin.id), { highlight: true })
    } else {
      bulletin.archived = true
      await updateDoc(doc(db, 'bulletins', bulletin.id), { archived: true })
    }
    loadBulletins()
  }
  iconRow.appendChild(edit)

  card.appendChild(iconRow)
  container.appendChild(card)
}

async function loadBulletins() {
  const listDiv = document.getElementById('bulletin-list')
  listDiv.innerHTML = ''
  const search = document.getElementById('search').value.toLowerCase()
  const data = await fetchBulletins()

  const filtered = data.filter(d =>
    d.title.toLowerCase().includes(search) ||
    d.content.toLowerCase().includes(search) ||
    d.createdBy?.toLowerCase().includes(search)
  )

  filtered.forEach(b => renderBulletin(b, listDiv))
}

window.onload = () => {
  document.getElementById('search').addEventListener('input', loadBulletins)
  loadBulletins()
}
