import { db } from '/js/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const urlParams = new URLSearchParams(window.location.search);
const repairId = urlParams.get('id');
const container = document.getElementById('print-container');

async function render() {
  if (!repairId) return container.innerText = '無法讀取維修單號';

  const docRef = doc(db, 'repairs', repairId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    container.innerText = '查無資料';
    return;
  }

  const d = snapshot.data();

  container.innerHTML = `
    <div class="paper">
      <div class="bar">產品維修單</div>
      <div class="header">
        <img src="/img/logo-black.png" class="logo" />
        <div class="info">
          <div class="title">數位小兔攝影週邊器材行</div>
          <div class="address">台北市信義區大道路74巷1號</div>
          <div class="tel">TEL：(02)2759-2013 / (02)2759-2006</div>
        </div>
      </div>
      <div class="meta">
        <div>維修單號：${repairId}</div>
        <div>填單日期：${d.date || ''}</div>
      </div>
      <div class="meta">保固：${d.warranty || ''}</div>
      <div class="meta">客戶資訊：${[d.customer, d.line, d.phone, d.address].filter(Boolean).join('<br>')}</div>
      <div class="meta">維修項目：${d.product || ''}</div>
      <div class="meta">備註：${d.note || ''}</div>
      <div class="footer">
        <div>經手人：${d.nickname || ''}</div>
        <div>官方LineID: @digirabbit</div>
      </div>
    </div>
  `;
}

render();