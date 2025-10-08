
document.querySelector("#sendTest").addEventListener("click", async () => {
  const product = {
    name: "測試商品",
    price: 999
  }

  try {
    const res = await fetch("/api/receive-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product)
    })

    const data = await res.json()
    console.log("✅ response:", data)
    document.querySelector("#result").textContent = JSON.stringify(data)
  } catch (e) {
    console.error("🔥 error:", e)
    document.querySelector("#result").textContent = "❌ 錯誤：" + e.message
  }
})
