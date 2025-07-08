
window.onload = () => {
  const form = document.getElementById('envelopeForm');
  const customWrapper = document.getElementById('customSenderWrapper');
  const senderType = document.getElementById('senderType');
  const successMessage = document.getElementById('successMessage');

  senderType.addEventListener('change', () => {
    customWrapper.style.display = senderType.value === 'custom' ? 'block' : 'none';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      senderType: senderType.value,
      senderName: document.getElementById('customSender').value,
      recipient: document.getElementById('recipient').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value,
      product: document.getElementById('product').value,
      source: document.getElementById('source').value,
      account: document.getElementById('account').value,
      createdAt: new Date().toISOString()
    };
    const id = Date.now().toString();
    localStorage.setItem("envelope_" + id, JSON.stringify(data));
    window.open("print.html?id=" + id, "_blank");
    successMessage.style.display = 'block';
    setTimeout(() => successMessage.style.display = 'none', 3000);
    form.reset();
    loadTodayRecords();
  });

  function loadTodayRecords() {
    const tbody = document.getElementById("recordBody");
    tbody.innerHTML = "";
    const today = new Date().toISOString().slice(0, 10);
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("envelope_")) {
        const item = JSON.parse(localStorage.getItem(key));
        if (item.createdAt.startsWith(today)) {
          const date = new Date(item.createdAt);
          const timeString = date.toLocaleTimeString("zh-TW", {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${timeString}</td>
            <td>${item.recipient}</td>
            <td>${item.address}</td>
            <td>${item.product}</td>
            <td>${item.source}</td>
            <td>${item.account}</td>
            <td><button onclick="window.open('print.html?id=${key.slice(9)}')">再印一次</button></td>
          `;
          tbody.appendChild(tr);
        }
      }
    });
  }

  loadTodayRecords();
};
