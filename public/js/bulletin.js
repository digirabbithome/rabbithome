// 初始化資料（示意）
window.onload = () => {
  const nickname = localStorage.getItem('nickname') || '訪客'
  const group = localStorage.getItem('group') || '未知'
  const email = localStorage.getItem('email') || ''
  document.getElementById('edict-section').innerText = `登入者：${nickname}（${group}）`
  // TODO: 載入公告清單與留言標記互動功能
}
