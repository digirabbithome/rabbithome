import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const groupMap = {
  '外場': '📌 外場',
  '內場': '📌 內場',
  '出貨': '📌 出貨',
  '美編': '📌 美編',
  '行銷': '📌 行銷'
}

const pastelColors = ['#ff88aa', '#a3d8ff', '#fff2a3', '#e4d8d8', '#c8facc']
let currentRangeDays = 14
let allDocs = []

// users nickname -> uid mapping (non-resigned only)
let usersByNick = new Map()
async function preloadUsersByNickname() {
  usersByNick.clear()
  const snap = await getDocs(collection(db, 'users'))
  snap.forEach(d => {
    const v = d.data() || {}
    const emp = (v.employment || 'full-time').toString().toLowerCase()
    if (emp === 'resigned') return
    const nick = (v.nickname || v.name || (v.email ? v.email.split('@')[0] : d.id) || '').trim()
    if (nick) usersByNick.set(nick, d.id)
  })
}

// Chat bridge (iframe-safe)
function getChat() {
  if (typeof window !== 'undefined') {
    if (window.RabbitChat) return window.RabbitChat
    try { if (window.parent && window.parent !== window && window.parent.RabbitChat) return window.parent.RabbitChat } catch(_) {}
  }
  return null
}

// helpers
const pad = n => String(n).padStart(2, '0')
function formatNow(){ const d=new Date(); return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Detect first "colon-like" character
const COLONS = new Set([':', '：', '﹕', '∶'])
function splitByFirstColon(s){
  for(let i=0;i<s.length;i++){ const ch=s[i]; if(COLONS.has(ch)) return [s.slice(0,i), s.slice(i+1)] }
  return null
}

// Robust parse: try (1) after removing author prefix, (2) whole string, (3) fallback null
function parseTargetAndItem(displayText, authorName){
  const full = String(displayText || '').trim()
  // 1) remove author prefix like "花花：" once
  let s = full
  if(authorName){
    const re = new RegExp('^\\s*' + escapeReg(authorName) + '\\s*[：:]\\s*')
    s = s.replace(re, '')
  }
  let parts = splitByFirstColon(s)
  if(parts && parts[0].trim()){ return { toNick: parts[0].trim(), item: parts[1].trim() } }
  // 2) fallback: whole string
  parts = splitByFirstColon(full)
  if(parts && parts[0].trim()){ return { toNick: parts[0].trim(), item: parts[1].trim() } }
  // 3) final fallback
  return { toNick: null, item: s }
}

window.onload = async () => {
  const now = new Date()
  document.getElementById('datePicker').value = now.toISOString().split('T')[0]

  document.getElementById('prev-day').addEventListener('click', () => updateRange(1))
  document.getElementById('prev-3days').addEventListener('click', () => updateRange(3))
  document.getElementById('prev-week').addEventListener('click', () => updateRange(7))
  document.getElementById('prev-month').addEventListener('click', () => updateRange(30))
  document.getElementById('datePicker').addEventListener('change', (e) => {
    const selected = new Date(e.target.value)
    renderBulletins(selected, 1)
  })
  document.getElementById('searchBox').addEventListener('input', () => {
    renderBulletins(new Date(), currentRangeDays)
  })
  document.getElementById('showAll').addEventListener('change', () => {
    renderBulletins(new Date(), currentRangeDays)
  })

  await preloadUsersByNickname()
  await preloadAllDocsWithinOneYear()
  renderBulletins(new Date(), currentRangeDays)
}

async function preloadAllDocsWithinOneYear() {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const q = query(collection(db, 'bulletins'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  allDocs = []
  snapshot.forEach(docSnap => {
    const d = docSnap.data()
    const createdAt = d.createdAt?.toDate?.()
    if (!createdAt || createdAt < oneYearAgo) return
    d._id = docSnap.id
    d._createdAt = createdAt
    allDocs.push(d)
  })
}

function updateRange(days) {
  currentRangeDays = days
  renderBulletins(new Date(), days)
}

async function renderBulletins(endDate, rangeDays) {
  const container = document.getElementById('bulletin-board')
  container.innerHTML = ''

  const dateStr = endDate.toISOString().split('T')[0]
  document.getElementById('date-title').textContent = `📌 公布欄：${dateStr}（往前${rangeDays}天）`

  const endDateFull = new Date(endDate); endDateFull.setHours(23, 59, 59, 999)
  const startDate = new Date(endDateFull); startDate.setDate(startDate.getDate() - (rangeDays - 1)); startDate.setHours(0, 0, 0, 0)

  const keyword = document.getElementById('searchBox')?.value.trim().toLowerCase() || ''
  const showAll = document.getElementById('showAll')?.checked

  const filtered = allDocs.filter(d => {
    if (!d._createdAt || d._createdAt < startDate || d._createdAt > endDateFull) return false
    if (!keyword) return true
    const content = (d.content || []).join(' ').toLowerCase()
    const name = (d.createdBy || d.nickname || '').toLowerCase()
    return content.includes(keyword) || name.includes(keyword)
  })

  const grouped = {}
  filtered.forEach(d => {
    const targets = d.visibleTo || ['未知']
    const contentList = d.content?.join?.('\\n') || ''
    const nickname = d.createdBy || d.nickname || '匿名者'
    const displayText = nickname + '：' + contentList

    targets.forEach(group => {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push({ text: displayText, id: d._id, isStarred: d.isStarred, state: d.markState || 'none', author: nickname })
    })
  })

  let colorIndex = 0
  for (const group in grouped) {
    const groupDiv = document.createElement('div')
    groupDiv.className = 'group-block'
    const title = document.createElement('h3')
    title.textContent = groupMap[group] || group
    title.style.backgroundColor = pastelColors[colorIndex % pastelColors.length]
    colorIndex++
    groupDiv.appendChild(title)

    grouped[group].forEach(({ text, id, isStarred, state, author }) => {
      const p = document.createElement('p')
      p.dataset.state = state

      const contentSpan = document.createElement('span')
      contentSpan.textContent = text
      if (state === 'highlight') contentSpan.style.backgroundColor = '#fffbbd'
      else if (state === 'pink') contentSpan.style.backgroundColor = '#ffddee'

      if (state === 'hidden' && !showAll) {
        return
      } else if (state === 'hidden' && showAll) {
        p.style.opacity = 0.4
        contentSpan.style.color = '#999'
      }

      const star = document.createElement('span')
      star.textContent = isStarred ? '⭐' : '☆'
      star.style.cursor = 'pointer'
      star.style.marginRight = '0.5rem'
      star.addEventListener('click', async () => {
        const newStatus = star.textContent === '☆'
        star.textContent = newStatus ? '⭐' : '☆'
        const newState = newStatus ? 'pink' : 'none'
        p.dataset.state = newState
        if (newState === 'pink') { contentSpan.style.backgroundColor = '#ffddee'; p.style.opacity = 1; p.style.display = '' }
        else { contentSpan.style.backgroundColor = ''; p.style.opacity = 1; p.style.display = '' }
        await updateDoc(doc(db, 'bulletins', id), { isStarred: newStatus, markState: newState })
      })

      const pencil = document.createElement('span')
      pencil.textContent = '🖊️'
      pencil.style.cursor = 'pointer'
      pencil.style.marginRight = '0.5rem'
      pencil.addEventListener('click', async () => {
        let newState = 'none'
        if (p.dataset.state === 'none') {
          contentSpan.style.backgroundColor = '#fffbbd'
          p.style.opacity = 1; p.style.display = ''
          newState = 'highlight'

          const { toNick, item } = parseTargetAndItem(contentSpan.textContent, author)
          const trimmedNick = (toNick || '').trim()
          const toUid = usersByNick.get(trimmedNick)
          const chat = getChat()
          console.log('[bulletin->dm]', { author, raw: contentSpan.textContent, toNick: trimmedNick, toUid, hasChat: !!chat })
          if (trimmedNick && toUid && chat && typeof chat.sendTo === 'function') {
            const msg = `${author}：${trimmedNick}！${item} 已於 ${formatNow()} 到公司囉 💕`
            try { await chat.sendTo(toUid, msg) } catch (e) { console.warn('sendTo failed', e) }
          } else {
            console.warn('無法發送：暱稱/UID/聊天物件缺一', { trimmedNick, toUid, chatOk: !!chat })
          }
        } else if (p.dataset.state === 'highlight') {
          contentSpan.style.backgroundColor = ''
          p.style.display = 'none'
          newState = 'hidden'
        } else {
          contentSpan.style.backgroundColor = ''
          p.style.display = ''
          p.style.opacity = 1
          newState = 'none'
        }
        p.dataset.state = newState
        await updateDoc(doc(db, 'bulletins', id), { markState: newState })
      })

      p.appendChild(pencil)
      p.appendChild(star)
      p.appendChild(contentSpan)
      groupDiv.appendChild(p)
    })

    container.appendChild(groupDiv)
  }
}