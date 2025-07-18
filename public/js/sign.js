
import { auth, db, storage } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

let nickname = '未登入'

onAuthStateChanged(auth, async user => {
  if (!user) {
    const redirectUrl = encodeURIComponent(window.location.href)
    window.location.href = `/login.html?redirect=${redirectUrl}`
  } else {
    nickname = localStorage.getItem('nickname') || '未登入'
    document.getElementById('nickname').innerText = nickname
    await loadCompanies()
  }
})

// 載入公司清單（供應商）並排序
async function loadCompanies() {
  const companySelect = document.getElementById('companyList')
  if (!companySelect) return
  const snapshot = await getDocs(collection(db, 'suppliers'))
  const companies = []
  snapshot.forEach(doc => {
    const data = doc.data()
    if (data.code && data.shortName) {
      companies.push({ code: data.code, shortName: data.shortName })
    }
  })
  companies.sort((a, b) => a.code.localeCompare(b.code))
  companies.forEach(c => {
    const opt = document.createElement('option')
    opt.value = `${c.code}-${c.shortName}`
    opt.textContent = `${c.code}-${c.shortName}`
    companySelect.appendChild(opt)
  })
}

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

  const submitBtn = document.getElementById('submit')
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const type = document.getElementById('typeSelect')?.value || ''
      const company = document.getElementById('companyList')?.value || ''
      const customCompany = document.getElementById('customCompany')?.value || ''
      const amount = document.getElementById('amount')?.value || ''
      const note = document.getElementById('note')?.value || ''
      const signRef = ref(storage, `signatures/${Date.now()}.png`)
      canvas.toBlob(async (blob) => {
        if (!blob) return
        await uploadBytes(signRef, blob)
        const url = await getDownloadURL(signRef)
        await addDoc(collection(db, 'signs'), {
          nickname,
          type,
          company,
          customCompany,
          amount,
          note,
          signatureURL: url,
          createdAt: serverTimestamp()
        })
        alert('已成功送出簽收紀錄！')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      })
    })
  }
}
