
import { auth, db } from '/js/firebase.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

onAuthStateChanged(auth, user => {
  if (!user) {
    const redirectUrl = encodeURIComponent(window.location.href)
    window.location.href = `/login.html?redirect=${redirectUrl}`
  } else {
    const nickname = localStorage.getItem('nickname') || '未登入'
    document.getElementById('form-title').innerText = `📝 新增簽收單（${nickname}）`
  }
})
