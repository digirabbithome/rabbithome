
import { db } from '/js/firebase.js'
import { collection, query, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const snapshot = await getDocs(query(collection(db, "signs"), orderBy("createdAt", "desc")));
  const list = snapshot.docs.map(doc => doc.data());
  const tbody = document.getElementById("sign-body");
  tbody.innerHTML = list.map(d => `
    <tr>
      <td>${new Date(d.createdAt?.seconds * 1000).toLocaleDateString()}</td>
      <td>${d.type2 || ""}</td>
      <td>${d.note || ""}</td>
      <td>${d.amount || ""}</td>
      <td>${d.nickname || ""}</td>
      <td><img src="${d.signatureUrl}" class="thumb" /></td>
    </tr>
  `).join("");
};
