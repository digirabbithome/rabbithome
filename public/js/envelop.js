
const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

window.addEventListener('load', () => {
  const form = document.getElementById('envelopeForm');
  const companySelect = document.getElementById('senderCompany');
  const customSenderWrapper = document.getElementById('customSenderWrapper');

  companySelect.addEventListener('change', () => {
    customSenderWrapper.style.display = companySelect.value === '其他' ? 'block' : 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const source = Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value).join(",");
    const data = {
      senderCompany: companySelect.value,
      customSender: document.getElementById('customSender').value,
      recipientName: document.getElementById('recipientName').value,
      recipientPhone: document.getElementById('recipientPhone').value,
      recipientAddress: document.getElementById('recipientAddress').value,
      product: document.getElementById('product').value,
      source,
      account: document.getElementById('account').value,
      timestamp: new Date().toISOString()
    };
    await db.collection("envelopes").add(data);
    window.open("/print.html", "_blank");
    alert("資料已送出！");
    form.reset();
    loadTodayRecords();
  });

  async function loadTodayRecords() {
    const today = new Date().toISOString().slice(0, 10);
    const tableBody = document.querySelector("#todayRecords tbody");
    tableBody.innerHTML = "";
    const snapshot = await db.collection("envelopes").get();
    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.timestamp && d.timestamp.startsWith(today)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${d.timestamp.slice(11, 16)}</td>
          <td>${d.recipientName}</td><td>${d.recipientAddress}</td>
          <td>${d.recipientPhone}</td><td>${d.product}</td>
          <td>${d.source}</td><td>${d.account}</td>
          <td><button onclick="window.open('/print.html')">列印</button></td>`;
        tableBody.appendChild(tr);
      }
    });
  }

  loadTodayRecords();
});
