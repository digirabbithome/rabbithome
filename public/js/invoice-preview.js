import { db } from '/js/firebase.js'
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $ = (s, r=document)=>r.querySelector(s)

window.onload = async () => {
  $('#backBtn')?.addEventListener('click', ()=> window.history.back())
  $('#printBtn')?.addEventListener('click', ()=> window.print())
  $('#toggleDetail')?.addEventListener('change', e=>{
    $('#detailArea').classList.toggle('visible', e.target.checked)
  })

  const params = new URLSearchParams(location.search)
  const invoiceNumber = params.get('invoiceNumber')
  const companyId = params.get('companyId') || ''

  if (!invoiceNumber) { alert('缺少發票號碼'); return }

  let q = companyId
    ? query(collection(db,'invoices'), where('invoiceNumber','==',invoiceNumber), where('companyId','==',companyId))
    : query(collection(db,'invoices'), where('invoiceNumber','==',invoiceNumber))

  const snap = await getDocs(q)
  if (snap.empty) { alert('找不到這張發票資料'); return }
  renderInvoice(snap.docs[0].data())
}

function renderInvoice(inv){
  $('#invoiceNumber').textContent = inv.invoiceNumber || ''
  $('#randomNumber').textContent = inv.randomNumber || '----'
  $('#totalAmount').textContent = inv.amount || 0

  const seller = inv.sellerGUI || '48594728'
  const buyer = (inv.buyerGUI||'').trim()
  $('#sellerGUI').textContent = `賣方 ${seller}`
  $('#buyerGUI').textContent  = buyer && buyer!=='00000000' ? `買方 ${buyer}` : '買方 —'

  const d = inv.createdAt?.toDate() || new Date()
  const roc = d.getFullYear() - 1911
  const m = d.getMonth()+1
  const ps = m%2===1?m:m-1
  const pe = ps+1
  $('#periodText').textContent = `${roc}年${String(ps).padStart(2,'0')}-${String(pe).padStart(2,'0')}月`
  $('#datetimeText').textContent = d.toLocaleString('zh-TW',{hour12:false}).replace(/\//g,'-')

  try{ JsBarcode('#barcode', inv.invoiceNumber||'', {format:'CODE128',displayValue:false,height:80,margin:0}) }catch(e){}

  $('#qrLeft').innerHTML=''
  $('#qrRight').innerHTML=''
  new QRCode($('#qrLeft'), {text:`INV*${inv.invoiceNumber}*${inv.randomNumber}`,width:150,height:150})
  new QRCode($('#qrRight'),{text:String(inv.amount||0),width:150,height:150})

  buildDetail(inv.items||[], inv.amount||0)
}

function buildDetail(items, amount){
  const area = $('#detailArea')
  if (!items.length){ area.innerHTML=''; return }
  area.innerHTML = `
    <div class="detail-divider">-------------------- ✂ --------------------</div>
    <div class="detail-title">銷售明細</div>
    <table class="detail-table">
      <thead><tr><th>#</th><th>品名</th><th>數量</th><th>金額</th></tr></thead>
      <tbody>
      ${items.map((it,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(it.name||'')}</td><td style="text-align:right;">${it.qty||0}</td><td style="text-align:right;">${it.amount||0}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="detail-total">總計：${amount} 元</div>
    <div class="detail-foot">臺北市信義區大道路74巷1號</div>
    <div class="detail-foot">TEL：02-27592006</div>
  `
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
