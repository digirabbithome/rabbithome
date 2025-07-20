
const params = new URLSearchParams(window.location.search);
const serial = params.get('serial') || '07191053';
const contact = params.get('contact') || '未填寫';
const product = params.get('product') || '';
const note = params.get('note') || '';
const paid = params.get('paid') || '';
const createdBy = params.get('createdBy') || '';

const area = document.getElementById('print-area');
area.innerHTML = `
  <h2>📦 數位小兔取貨單</h2>
  <div class="print-divider"></div>
  <div id="print-serial">${serial}</div>
  <p><strong>聯絡人：</strong>${contact}</p>
  <p><strong>商品內容：</strong><br>${product}</p>
  <p><strong>備註：</strong>${note}</p>
  <p><strong>付款狀態：</strong>${paid}</p>
  <p><strong>填單人：</strong>${createdBy}</p>
`;

window.print();
