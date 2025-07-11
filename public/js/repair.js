
function getStatusText(status) {
  switch (status) {
    case 1: return "新進維修";
    case 2: return "已交付廠商";
    case 3: return "維修完成";
    case 4: return "客人已取貨";
    default: return "未知";
  }
}

function renderTable(data) {
  const tbody = document.getElementById("repair-list");
  tbody.innerHTML = "";
  data.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="repair-edit.html?id=${d.repairID}" target="_blank">${d.repairID}</a></td>
      <td>${d.supplier}</td>
      <td>${d.description || ""}</td>
      <td>${getStatusText(d.status)}</td>
    `;
    tbody.appendChild(tr);
  });
}
