
function toggleCustomSender() {
  const select = document.getElementById('sender-company');
  const custom = document.getElementById('custom-sender');
  if (select.value === '其他') {
    custom.style.display = 'block';
  } else {
    custom.style.display = 'none';
  }
}

function submitEnvelope() {
  const sender = document.getElementById('sender-company').value;
  const customSender = document.getElementById('custom-sender').value;
  const name = document.getElementById('recipient-name').value;
  const phone = document.getElementById('recipient-phone').value;
  const address = document.getElementById('recipient-address').value;
  const product = document.getElementById('product').value;
  const account = document.getElementById('account').value;

  const sources = Array.from(document.querySelectorAll('input[name="source"]:checked'))
                      .map(el => el.value).join(',');

  const params = new URLSearchParams({
    sender: sender,
    customSender: customSender,
    name: name,
    phone: phone,
    address: address,
    product: product,
    source: sources,
    account: account
  });

  window.open("print.html?" + params.toString(), "_blank");
}
