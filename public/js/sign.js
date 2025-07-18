
import { auth } from '/js/firebase.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

onAuthStateChanged(auth, user => {
  if (!user) {
    const redirectUrl = encodeURIComponent(window.location.href)
    window.location.href = `/login.html?redirect=${redirectUrl}`
  } else {
    const nickname = localStorage.getItem('nickname') || '未登入'
    const nicknameSpan = document.getElementById('nickname')
    if (nicknameSpan) nicknameSpan.innerText = nickname
  }
})

window.onload = () => {
  const canvas = document.getElementById('signature')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let drawing = false

  const getPosition = (e) => {
    if (e.touches && e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect()
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    } else {
      return {
        x: e.offsetX,
        y: e.offsetY
      }
    }
  }

  const startDrawing = (e) => {
    drawing = true
    const pos = getPosition(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e) => {
    if (!drawing) return
    e.preventDefault()
    const pos = getPosition(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => {
    drawing = false
    ctx.closePath()
  }

  canvas.addEventListener('mousedown', startDrawing)
  canvas.addEventListener('mousemove', draw)
  canvas.addEventListener('mouseup', stopDrawing)
  canvas.addEventListener('mouseout', stopDrawing)

  canvas.addEventListener('touchstart', startDrawing)
  canvas.addEventListener('touchmove', draw)
  canvas.addEventListener('touchend', stopDrawing)

  const clearBtn = document.getElementById('clear')
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    })
  }
}
