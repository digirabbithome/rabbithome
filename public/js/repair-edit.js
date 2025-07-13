
function updateStatusInfo(status) {
  const box = document.getElementById('status-info-box');
  if (!box) return;

  let text = '⏳ 目前狀況：';
  switch (status) {
    case 1:  text += '已收到維修尚未寄送廠商'; break;
    case 2:  text += '已收到維修且寄送廠商了'; break;
    case 3:  text += '已送修 且修復完畢'; break;
    case 31: text += '已送修 但無法處理或遭退件'; break;
    case 4:  text += '本維修單已處理完成結案'; break;
    default: text += '尚無狀態資料';
  }
  box.textContent = text;
}



box.textContent = text
}



import { db, storage } from '/js/firebase.js'
import {
  doc, getDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

const nickname = localStorage.getItem('nickname') || '不明使用者';

function renderStatusBlock(statusCode, title, noteLabel, placeholder, d) {
  if (statusCode === 1) {
    const user = d.user || '未知使用者';
    const created = d.createdAt?.toDate?.();
    const timeStr = created ? `${created.getFullYear()}/${created.getMonth()+1}/${created.getDate()} ${created.getHours()}:${created.getMinutes().toString().padStart(2,'0')}` : '';
    return `
      <div class="status-block" data-status="1">
        <h3>1. 已收送修　🐰 ${user}　🕒 ${timeStr}</h3>
      </div>
    `;
  }

  const history = d.history?.[statusCode];
  const noteVal = d.notes?.[statusCode] || '';
  const user = history?.user || '';
  const timeStr = history?.time ? new Date(history.time).toLocaleString() : '';

  return `
    <div class="status-block" data-status="${statusCode}">
      ${!history ? `<button class="status-btn" data-next="${statusCode}">${title}</button>` 
                  : `<h3>${title}　🐰 ${user}　🕒 ${timeStr}</h3>`}
      <textarea data-note="${statusCode}" placeholder="${placeholder || ''}">${noteVal}</textarea>
    </div>
  `;
}

const statusHTML = (d) => `
  ${renderStatusBlock(1, '1. 已收送修', '', '', d)}
  ${renderStatusBlock(2, '2. 已送廠商', '物流單號／寄送說明', '請輸入物流單號或寄送說明', d)}
  ${renderStatusBlock(3, '3. 維修完成', '維修說明', '請輸入處理狀況', d)}
  ${renderStatusBlock(31, '3-1. 廠商退回', '退回原因', '請輸入退回說明', d)}
  ${renderStatusBlock(4, '4. 客人已取回', '客戶回饋', '請填寫交貨說明或客戶回饋', d)}
`;

window.onload = async () => {
  const params = new URLSearchParams(location.search);
  const repairId = params.get('id');
  if (!repairId) {
    document.getElementById('edit-section').innerHTML = '❌ 無效的維修單號';
    return;
  }

  const docRef = doc(db, 'repairs', repairId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    document.getElementById('edit-section').innerHTML = '❌ 查無此筆資料';
    return;
  }

  const d = snapshot.data();

  // 顯示圖片
  const imgHTML = (d.photos || []).map(url => `<img src="${url}" style="max-height:100px;margin:6px;border:1px solid #ccc">`).join('');

  const html = `
    <table class="repair-info">
      <tr>
        <td><b>維修單號：</b>${d.repairId}</td>
        <td><b>保固：</b>${d.warranty || ''}</td>
        <td><b>廠商：</b>${d.supplier || ''}</td>
      </tr>
      ${d.customer ? `<tr><td colspan="3"><b>聯絡資訊：</b>${d.customer} ${d.phone || ''} ${d.address || ''}</td></tr>` : ''}
      <tr><td colspan="3"><b>送修商品：</b>${d.product || ''}　　<b>維修內容：</b>${d.description || ''}</td></tr>
      <tr><td colspan="3"><b>商品圖片：</b><br>${imgHTML}<br><input type="file" id="upload-photo" multiple /></td></tr>
    </table>

    ${statusHTML(d)}

    <div id="final-actions">
      <button onclick="window.open('/repair-print.html?id=${repairId}')">📄 列印維修單</button>
      <button onclick="window.open('/print.html?id=${repairId}')">✉️ 列印送修信封</button>
      <button onclick="window.open('/print-reply.html?id=${repairId}')">✉️ 列印廠商信封</button>
      <button data-next="4" class="status-btn">✅ 結案</button>
    </div>
  `;

  document.getElementById('edit-section').innerHTML = html;

  // 按鈕更新狀態
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.onclick = async () => {
      const next = btn.dataset.next;
      if (!confirm(`是否將狀態更新為「${next}」？`)) return;
      const now = new Date().toISOString();
      const update = {
        [`history.${next}`]: { user: nickname, time: now }
      };
      await updateDoc(docRef, update);
      alert('✅ 狀態已更新！');
      location.reload();
    };
  });

  // 自動儲存備註
  const debounceTimers = {};
  const showSavedHint = () => {
    let div = document.createElement('div');
    div.textContent = '✅ 已儲存';
    div.style.cssText = 'position:fixed;top:10px;right:20px;background:#4caf50;color:white;padding:6px 12px;border-radius:6px;z-index:9999;font-size:14px;';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  };

  document.querySelectorAll('textarea[data-note]').forEach(area => {
    const code = area.dataset.note;
    area.addEventListener('input', () => {
      clearTimeout(debounceTimers[code]);
      debounceTimers[code] = setTimeout(async () => {
        const value = area.value;
        if (d.notes?.[code] !== value) {
          await updateDoc(docRef, { [`notes.${code}`]: value });
          showSavedHint();
        }
      }, 1500);
    });
  });

  // 上傳照片
  document.getElementById('upload-photo')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const urls = d.photos || [];
    for (const file of files) {
      const storageRef = ref(storage, `repairs/${repairId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    await updateDoc(docRef, { photos: urls });
    alert('✅ 照片已上傳！');
    location.reload();
  });
};
