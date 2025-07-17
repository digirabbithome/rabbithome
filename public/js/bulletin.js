
const groups = {
  '外場': ['苑慈：NANUK 新品 包包', '花花：YOLOBOX有活動7/14–7/31'],
  '美編': ['花花：新品要通知', '彼君兒：Polaroid體驗會'],
  '內場': ['花花：YOLOBOX有活動7/14–7/31'],
  '出貨': ['花花：新品要通知'],
  '行銷': ['花花：YOLOBOX有活動7/14–7/31']
};

const pastel = {
  '外場': '#ff88aa',
  '美編': '#a3d8ff',
  '內場': '#fff2a3',
  '出貨': '#c8facc',
  '行銷': '#e4d8d8'
};

let currentColor = 'yellow'

window.onload = () => {
  const board = document.getElementById('bulletin-board')
  for (const group in groups) {
    const div = document.createElement('div')
    div.className = 'group-block'
    div.innerHTML = `<h3 style="background:${pastel[group]};padding:5px;border-radius:6px;">📌 ${group}</h3>` +
      groups[group].map(t => `<p>☆ ${t}</p>`).join('')
    board.appendChild(div)

    // 加 canvas 疊在上面
    const canvas = document.createElement('canvas')
    canvas.width = div.clientWidth
    canvas.height = div.clientHeight
    canvas.className = 'annotator'
    canvas.style.pointerEvents = 'auto'
    div.style.position = 'relative'
    div.appendChild(canvas)

    enableDrawing(canvas)
  }
}

function setColor(c) {
  currentColor = c
}

function enableDrawing(canvas) {
  const ctx = canvas.getContext('2d')
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  let drawing = false

  canvas.addEventListener('mousedown', e => {
    drawing = true
    ctx.beginPath()
    ctx.moveTo(e.offsetX, e.offsetY)
  })

  canvas.addEventListener('mousemove', e => {
    if (!drawing) return
    ctx.strokeStyle = currentColor
    ctx.lineTo(e.offsetX, e.offsetY)
    ctx.stroke()
  })

  canvas.addEventListener('mouseup', () => {
    drawing = false
  })
}
