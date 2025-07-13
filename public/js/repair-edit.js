
import { db, storage } from '/js/firebase.js'
import {
  doc, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL, listAll
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

const nickname = localStorage.getItem('nickname') || '不明使用者';

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
  const date = d.createdAt?.toDate?.();
  const dateStr = date ? `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}` : '';

  // 狀態切換按鈕
  let statusBtn = '';
  const current = d.status || 1;
  if (current === 1) {
    statusBtn = `<button data-next="2">➡️交付廠商</button> <button data-next="3">✅完成</button> <button data-next="31">↩️退回</button>`;
  } else if (current === 2) {
    statusBtn = `<button data-next="3">✅完成</button> <button data-next="31">↩️退回</button>`;
  } else if (current === 3 || current === 31) {
    statusBtn = `<button data-next="4">📦已取貨</button>`;
  }

  // 圖片顯示與補上傳
  const imgHTML = (d.photos || []).map(url => `<img src="${url}" style="max-height:100px;margin:6px;border:1px solid #ccc">`).join('');
  const historyHTML = Object.entries(d.history || {}).map(([k, v]) => {
    return `<div>狀態 ${k} ➜ ${v.user} @ ${new Date(v.time).toLocaleString()}</div>`;
  }).join('');

  const html = `
    <table>
      <tr><td>維修單號</td><td><b>${d.repairId}</b></td></tr>
      <tr><td>姓名</td><td>${d.customer}</td></tr>
      <tr><td>電話</td><td>${d.phone}</td></tr>
      <tr><td>地址</td><td>${d.address}</td></tr>
      <tr><td>商品</td><td>${d.product}</td></tr>
      <tr><td>描述</td><td>${d.description}</td></tr>
      <tr><td>保固</td><td>${d.warranty}</td></tr>
      <tr><td>廠商</td><td>${d.supplier}</td></tr>
      <tr><td>送修日期</td><td>${dateStr}</td></tr>
      <tr><td>目前狀態</td><td>${current}</td></tr>
      <tr><td>狀態操作</td><td>${statusBtn}</td></tr>
      <tr><td>歷程紀錄</td><td>${historyHTML}</td></tr>
      <tr><td>現有圖片</td><td>${imgHTML}</td></tr>
      <tr><td>補上傳照片</td><td><input type="file" id="upload-photo" multiple /></td></tr>
    </table>
  `;

  document.getElementById('edit-section').innerHTML = html;

  document.querySelectorAll('button[data-next]').forEach(btn => {
    btn.onclick = async () => {
      const next = parseInt(btn.dataset.next);
      const confirmMsg = `是否要將狀態更新為 ${next}？`;
      if (!confirm(confirmMsg)) return;

      await updateDoc(docRef, {
        status: next,
        [`history.${next}`]: {
          user: nickname,
          time: new Date().toISOString()
        }
      });
      alert('✅ 狀態已更新！');
      location.reload();
    }
  });

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
