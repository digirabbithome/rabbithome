
document.getElementById('repair-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const warranty = document.querySelector('input[name="warranty"]:checked').value;
  alert('送出的保固狀況是：' + warranty);
});
