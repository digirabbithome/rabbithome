
import { db } from '/js/firebase.js'
import {
  collection, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const payerSelect = document.getElementById('payer')
  if (payerSelect) {
    const snapshot = await getDocs(collection(db, 'users'))
    snapshot.forEach(doc => {
      const d = doc.data()
      if (d.nickname) {
        const opt = document.createElement('option')
        opt.textContent = d.nickname
        payerSelect.appendChild(opt)
      }
    })
  }

  const canvas = document.getElementById('signature')
  const ctx = canvas.getContext('2d')
  let drawing = false

  function resizeCanvasToMatchContainer() {
    const containerWidth = canvas.parentElement.clientWidth
    const desiredHeight = 200
    canvas.width = containerWidth
    canvas.height = desiredHeight
  }
  resizeCanvasToMatchContainer()

  function getPos(e) {
    const rect = canvas.getBoundingClientRect()
    const x = e.touches ? e.touches[0].clientX : e.clientX
    const y = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (x - rect.left) * (canvas.width / rect.width),
      y: (y - rect.top) * (canvas.height / rect.height)
    }
  }

  function startDraw(e) {
    e.preventDefault()
    drawing = true
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e) {
    if (!drawing) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw() {
    drawing = false
  }

  canvas.addEventListener('mousedown', startDraw)
  canvas.addEventListener('mousemove', draw)
  canvas.addEventListener('mouseup', endDraw)
  canvas.addEventListener('mouseout', endDraw)
  canvas.addEventListener('touchstart', startDraw)
  canvas.addEventListener('touchmove', draw)
  canvas.addEventListener('touchend', endDraw)

  window.clearCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}
