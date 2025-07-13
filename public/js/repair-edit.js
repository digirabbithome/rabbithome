
import { db, storage } from '/js/firebase.js'
import {
  doc, getDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

const nickname = localStorage.getItem('nickname') || '不明使用者';

window.onload = async () => {
  const params = new URLSearchParams(location.search);
  const repairId = params.get('id');
  if (!repairId) return document.getElementById('edit-section').innerHTML = '❌ 無效的維修單號';

  const docRef = doc(db, 'repairs', repairId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return document.getElementById('edit-section').innerHTML = '❌ 查無此筆資料';

  const d = snapshot.data();
  const section = document.getElementById('edit-section');

  // 上方資訊組裝
  const topHTML = `
    <table class="repair-info">
      <tr>
        <td><b>維修單號：</b>${d.repairId}</td>
        <td><b>保固：</b>${d.warranty || ''}</td>
        <td><b>廠商：</b>${d.supplier || ''}</td>
      </tr>
      ${d.customer ? `<tr><td colspan="3"><b>聯絡資訊：</b>${d.customer} ${d.phone || ''} ${d.address || ''}</td></tr>` : ''}
      <tr><td colspan="3"><b>送修商品：</b>${d.product || ''}　　<b>維修內容：</b>${d.description || ''}</td></tr>
      <tr><td colspan="3">
        <b>商品圖片：</b><br>
        ${(d.photos || []).map(url => `<img src="${url}" style="max-height:100px;margin:6px;border:1px solid #ccc">`).join('')}
        <br><input type="file" id="upload-photo" multiple />
      </td></tr>
    </table>
  `;

  // 狀態區塊產生器

  function renderStatusBlock(statusCode, title, noteLabel) {
    if (statusCode === 1) {
      const user = d.user || '未知使用者';
      const created = d.createdAt?.toDate?.();
      const timeStr = created ? `${created.getFullYear()}/${created.getMonth()+1}/${created.getDate()} ${created.getHours()}:${created.getMinutes().toString().padStart(2,'0')}` : '';
      return `
        <div class="status-block" data-status="1">
          <h3>1. 已收送修</h3>
          <div>👤 ${user}　🕒 ${timeStr}</div>
        </div>
      `;
    }

    const history = d.history?.[statusCode];
    const noteVal = d.notes?.[statusCode] || '';
    return `
      <div class="status-block" data-status="${statusCode}">
        <h3>${title}</h3>
        ${history ? `<div>👤 ${history.user}　🕒 ${new Date(history.time).toLocaleString()}</div>` 
                  : `<button class="status-btn" data-next="${statusCode}">➡️ 開始此階段</button>`}
        ${noteLabel ? `<label>${noteLabel}</label><textarea data-note="${statusCode}">${noteVal}</textarea>` : ''}
      </div>
    `;
  }

  // 狀態區 HTML
  const statusHTML = `
    ${renderStatusBlock(1, '1. 已收送修', '')}
    ${renderStatusBlock(2, '2. 已送廠商', '物流單號／寄送說明')}
    ${renderStatusBlock(3, '3. 維修完成', '維修完成內容說明')}
    ${renderStatusBlock(31, '3-1. 廠商退回', '退回原因')}
    ${renderStatusBlock(4, '4. 客人已取回', '客戶回饋或交貨說明')}
  `;

  // 下方按鈕
  const finalButtons = `
    <div id="final-actions">
      <button onclick="window.open('/repair-print.html?id=${repairId}')">📄 列印維修單</button>
      <button onclick="window.open('/print.html?id=${repairId}')">✉️ 列印送修信封</button>
      <button onclick="window.open('/print-reply.html?id=${repairId}')">✉️ 列印廠商信封</button>
      <button data-next="4" class="status-btn">✅ 結案</button>
    </div>
  `;

  section.innerHTML = topHTML + statusHTML + finalButtons;

  // 綁定狀態更新按鈕
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

  
  // 儲存提示浮出
  const showSavedHint = () => {
    let div = document.createElement('div');
    div.textContent = '✅ 已儲存';
    div.style.cssText = 'position:fixed;top:10px;right:20px;background:#4caf50;color:white;padding:6px 12px;border-radius:6px;z-index:9999;font-size:14px;';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  };

  // 備註輸入 debounce 儲存
  const debounceTimers = {};
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


  // 圖片上傳
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
