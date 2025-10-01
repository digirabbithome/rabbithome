import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-external.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.sendData = async () => {
  const name = document.getElementById("name").value;
  const sku = document.getElementById("sku").value;
  const barcode = document.getElementById("barcode").value;
  const price = parseInt(document.getElementById("price").value);
  const stock = parseInt(document.getElementById("stock").value);

  try {
    await addDoc(collection(db, "products"), {
      name, sku, barcode, price, stock,
      createdAt: serverTimestamp()
    });
    alert("✅ 新增成功");
  } catch (e) {
    console.error("❌ 錯誤", e);
    alert("❌ 上傳失敗");
  }
};
