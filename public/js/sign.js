
const category = document.getElementById('category');
const subCategory = document.getElementById('subCategory');
const otherInput = document.getElementById('otherInput');
const subContainer = document.getElementById('subCategoryContainer');
const label = document.getElementById('subCategoryLabel');

category.addEventListener('change', () => {
  const value = category.value;
  subCategory.innerHTML = '';
  subCategory.style.display = 'none';
  otherInput.style.display = 'none';

  if (!value) {
    subContainer.style.display = 'none';
    return;
  }

  subContainer.style.display = 'block';

  if (value === '供應商') {
    label.textContent = '供應商名稱：';
    ['數位小兔', '聚焦數位', '免睡攝影', '其他'].forEach(opt => {
      const o = document.createElement('option');
      o.value = o.textContent = opt;
      subCategory.appendChild(o);
    });
    subCategory.style.display = 'inline';
  } else if (value === '物流') {
    label.textContent = '物流公司：';
    ['新竹貨運', '黑貓', '大榮', '宅配通', '其他'].forEach(opt => {
      const o = document.createElement('option');
      o.value = o.textContent = opt;
      subCategory.appendChild(o);
    });
    subCategory.style.display = 'inline';
  } else {
    label.textContent = '請輸入身份：';
    otherInput.style.display = 'inline';
  }
});

// ⬇️ Canvas 簽名邏輯（支援 mouse 與 touch）
const canvas = document.getElementById('signaturePad');
const ctx = canvas.getContext('2d');
let drawing = false;

function getPos(e) {
  if (e.touches && e.touches.length > 0) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return { x: e.offsetX, y: e.offsetY };
}

canvas.addEventListener('mousedown', e => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});
canvas.addEventListener('mousemove', e => {
  if (drawing) {
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  }
});
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseleave', () => drawing = false);

// 📱 Touch 支援
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const pos = getPos(e);
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (drawing) {
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
});
canvas.addEventListener('touchend', () => drawing = false);

document.getElementById('clear').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
