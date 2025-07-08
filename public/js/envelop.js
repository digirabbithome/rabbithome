
window.addEventListener("load", () => {
  const form = document.getElementById("envelopeForm");
  const companySelect = document.getElementById("company");
  const customCompany = document.getElementById("customCompany");
  const recordTable = document.querySelector("#recordTable tbody");
  const confirmation = document.getElementById("confirmationMessage");

  companySelect.addEventListener("change", () => {
    customCompany.style.display = companySelect.value === "其他" ? "block" : "none";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const time = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    const recipient = document.getElementById("recipient").value;
    const phone = document.getElementById("phone").value;
    const address = document.getElementById("address").value;
    const product = document.getElementById("product").value;
    const account = document.getElementById("account").value;
    const source = form.querySelector('input[name="source"]:checked')?.value || "";

    const senderName = companySelect.value === "其他" ? customCompany.value : companySelect.value;

    const row = document.createElement("tr");
    [time, recipient, address, phone, product, source, account].forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      row.appendChild(td);
    });

    const reprint = document.createElement("button");
    reprint.textContent = "再印一次";
    reprint.onclick = () => alert("🔁 準備再印一次！");
    const tdOp = document.createElement("td");
    tdOp.appendChild(reprint);
    row.appendChild(tdOp);

    recordTable.appendChild(row);
    confirmation.textContent = "✅ 信封產生完成，已加入下方列表！";

    // optional future: window.open("print.html", "_blank");
  });
});
