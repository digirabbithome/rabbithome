
// ...前略其他程式碼...

searchBox.addEventListener('input', () => {
  const keyword = searchBox.value.toLowerCase();
  list.innerHTML = '';

  data.forEach(d => {
    const name = d.shortName.slice(0, 4);
    const label = d.code + ' - ' + name;

    if (
      label.toLowerCase().includes(keyword) ||
      d.shortName.toLowerCase().includes(keyword)  // ✅ 新增這行
    ) {
      const li = document.createElement('li');
      li.textContent = label;
      li.dataset.code = d.code;
      li.dataset.name = d.shortName;
      li.addEventListener('click', () => {
        searchBox.value = label;
        searchBox.dataset.code = d.code;
        searchBox.dataset.name = d.shortName;
        list.innerHTML = '';
      });
      list.appendChild(li);
    }
  });
});
