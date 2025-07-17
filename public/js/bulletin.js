
import { db } from '/js/firebase.js'
import {
  updateDoc, doc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const params = new URLSearchParams(location.search)
const bulletinId = params.get("id") || "main"
const nickname = localStorage.getItem('nickname') || '匿名者'

function formatMarkup(text) {
  return text
    .replace(/\[yellow\](.*?)\[\/yellow\]/g, '<span style="background-color: yellow;">$1</span>')
    .replace(/\[pink\](.*?)\[\/pink\]/g, '<span style="background-color: pink;">$1</span>')
    .replace(/\[strike\](.*?)\[\/strike\]/g, '<span style="text-decoration: line-through;">$1</span>')
}

window.onload = async () => {
  const ref = doc(db, 'bulletins', bulletinId)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    document.getElementById('bulletin-board').innerHTML = '<p style="color:red">找不到此公告：' + bulletinId + '</p>'
    return
  }

  const d = snap.data()
  const board = document.getElementById('bulletin-board')

  const contentDiv = document.createElement('div')
  contentDiv.className = 'group-block'
  contentDiv.innerHTML = '<h3>📢 ' + d.title + '</h3>' + formatMarkup((d.content || '').replace(/\n/g, '<br>'))
  board.appendChild(contentDiv)

  const comments = d.comments || []
  const commentBox = document.createElement('div')
  commentBox.innerHTML = '<h4>💬 同事註記：</h4>'
  comments.forEach(c => {
    const p = document.createElement('div')
    p.className = 'comment'
    const date = c.time?.toDate?.()
    const timeStr = date ? date.toLocaleString() : ''
    p.innerHTML = `<div>${formatMarkup(c.text || '')}</div><small>🧑‍💼 ${c.user}　🕒 ${timeStr}</small>`
    commentBox.appendChild(p)
  })
  board.appendChild(commentBox)

  document.getElementById('submit-comment').onclick = async () => {
    const input = document.getElementById('comment-input')
    const text = input.value.trim()
    if (!text) return alert('請輸入留言內容')
    comments.push({ user: nickname, text, time: serverTimestamp() })
    await updateDoc(ref, { comments })
    location.reload()
  }
}
