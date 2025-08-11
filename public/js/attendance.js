// attendance.js
import { db } from '/js/firebase.js';
import { collection, query, where, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

async function loadData() {
  try {
    const q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => console.log(doc.data()));
  } catch (error) {
    if (error.code && error.code.includes('failed-precondition')) {
      console.error('Firestore 索引缺失:', error);
      alert('Firestore 查詢需要建立索引，請到控制台建立: ' + error.message.match(/https[^ ]+/)?.[0]);
    } else {
      console.error(error);
    }
  }
}

loadData();
