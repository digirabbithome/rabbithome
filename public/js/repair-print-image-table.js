
window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const titleText = params.get('type') || '產品維修單';
  document.getElementById('form-title').innerText = titleText;
};
