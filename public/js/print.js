
window.onload = () => {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const data = JSON.parse(localStorage.getItem("envelope_" + id));

  if (!data) {
    document.body.innerHTML = "<h2 style='color:red;'>⚠️ 找不到資料，請從主頁的填單流程送出信封後再列印</h2>";
    return;
  }

  const senderMap = {
    digitalrabbit: "數位小兔 Digital Rabbit",
    focus: "聚焦數位 Focus Camera",
    neversleep: "免睡攝影 Never Sleep Camera",
    custom: data.senderName || "自訂寄件人"
  };

  document.getElementById("envelope").innerHTML = `
    <div style="font-size: 16px; margin-bottom: 20px;">
      ${senderMap[data.senderType]}<br>
      110038 台北市信義區大道路74巷1號<br>
      TEL：(02) 2759–2013　LINE：@digirabbit
    </div>
    <div style="font-size: 24px; margin-top: 40px;">
      TO：${data.address}<br>
      ${data.recipient} ${data.phone} 收
    </div>
    <div style="margin-top: 30px;">${data.product ? data.product : ""}</div>
  `;
  setTimeout(() => window.print(), 500);
};
