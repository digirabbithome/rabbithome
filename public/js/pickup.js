
// 原有卡片產生處中，假設這是內容範例
function createPickupCard(d) {
  const note = d.note || '';
  const statusText = d.statusText || '';
  const nickname = d.createdBy || '匿名者';

  return `
    <div class="pickup-card">
      <div class="pickup-header">
        <div class="pickup-id">${d.serial || ''}</div>
        <div class="pickup-contact">${d.phone || ''} ${d.address || ''}</div>
      </div>
      <div class="pickup-body">
        <div class="pickup-product">${d.product || ''}</div>
        <div class="pickup-note">
          ${note}
          <span class="nickname">👤 ${nickname}</span>
        </div>
      </div>
    </div>
  `;
}
