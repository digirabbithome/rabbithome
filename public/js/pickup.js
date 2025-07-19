
document.querySelectorAll('.dot-sticker').forEach(dot => {
  dot.addEventListener('click', () => {
    const current = dot.dataset.state;

    if (current === 'green') {
      dot.dataset.state = 'yellow';
    } else if (current === 'yellow') {
      dot.remove(); // 第三次點擊就移除
    }
  });
});
