import { auth, db } from '/js/firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

window.onload = () => {
  const repairListDiv = document.getElementById('repair-list');
  repairListDiv.innerHTML = '🔒 確認登入中...';

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, 'repairs'));
      if (snapshot.empty) {
        repairListDiv.innerHTML = '😢 暫無維修資料';
        return;
      }

      let html = '<table border="1" cellspacing="0" cellpadding="6">';
      html += '<tr><th>流水號</th><th>廠商</th><th>狀況</th><th>狀態</th></tr>';

      snapshot.forEach(doc => {
        const data = doc.data();
        html += `
          <tr>
            <td><a href="repair-edit.html?id=${doc.id}" target="_blank">${doc.id}</a></td>
            <td>${data.supplier || ''}</td>
            <td>${data.description || ''}</td>
            <td>${getStatusText(data.status)}</td>
          </tr>
        `;
      });

      html += '</table>';
      repairListDiv.innerHTML = html;
    } catch (err) {
      repairListDiv.innerHTML = '❌ 載入失敗：' + err.message;
    }
  });
};

function getStatusText(statusCode) {
  switch (statusCode) {
    case 1: return '新進維修';
    case 2: return '已交付廠商';
    case 3: return '維修完成';
    case 4: return '客人已取貨';
    default: return '未知';
  }
}
