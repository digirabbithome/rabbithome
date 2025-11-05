// envelop.js r3 — 修正語法、維持功能，避免 '...' 損毀
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, getDocs,
  runTransaction, doc, setDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

let db, auth, me = null

const COMPANY = {
  rabbit: { zh:'數位小兔', en:'Digital Rabbit Co.', addr:'（請填公司地址）', phone:'（公司電話）', line:'@digitalrabbit' },
  focus:  { zh:'聚焦數位', en:'Focus Digital Co.', addr:'（請填公司地址）', phone:'（公司電話）', line:'@focus' },
  nosleep: { zh:'免睡攝影', en:'No Sleep Studio', addr:'（請填公司地址）', phone:'（公司電話）', line:'@nosleep' },
  other:  { zh:'其他', en:'Other Sender', addr:'', phone:'', line:'' }
}

const $ = (s,r=document)=>r.querySelector(s)
const el = (t,c)=>{ const x=document.createElement(t); if(c) x.className=c; return x }
const TPE='Asia/Taipei'
const fmtDate = (d)=> new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, year:'numeric', month:'2-digit', day:'2-digit' }).format(d)
const fmtTime = (d)=> new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' }).format(d)

let RANGE = { start:null, end:null }
let cache = []
let sortKey = 'time', sortDir = 'desc'

window.onload = async () => {
  auth = getAuth()
  db = getFirestore()
  onAuthStateChanged(auth, (u)=> me=u || null)

  bindUI()
  $('#btnNew').click()
  setQuickRange('3d')
  await reloadRecords()
}

// Helpers for serial
function mmdd(d){ const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return m+dd }
function ymd(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }

async function nextSerial(isBig){
  const today = new Date()
  const id = ymd(today) + '-' + (isBig ? 'big' : 'normal')
  const ref = doc(getFirestore(), 'envelop-counters', id)
  try{
    const snap = await getDoc(ref)
    let last = 0
    if (snap.exists()) last = Number(snap.data()?.last || 0)
    const next = last + 1
    await setDoc(ref, { date: ymd(today), type: isBig ? 'big' : 'normal', last: next, updatedAt: serverTimestamp() }, { merge:true })
    const core = mmdd(today) + String(next).padStart(3,'0')
    return isBig ? 'B'+core : core
  }catch(e){
    // fallback local
    const key = 'envctr-'+id
    let last = Number(localStorage.getItem(key)||'0') + 1
    localStorage.setItem(key, String(last))
    const core = mmdd(today) + String(last).padStart(3,'0')
    return isBig ? 'B'+core : core
  }
}

function bindUI(){
  $('#btnNew').addEventListener('click', ()=>{
    $('#formSection').classList.remove('hidden')
    $('#listSection').classList.add('hidden')
    previewSerial()
  })
  $('#btnList').addEventListener('click', async ()=>{
    $('#formSection').classList.add('hidden')
    $('#listSection').classList.remove('hidden')
    await reloadRecords()
  })

  document.querySelectorAll('[data-range]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      setQuickRange(b.dataset.range); await reloadRecords()
    })
  })
  $('#btnPickDay').addEventListener('click', async ()=>{
    const d = $('#pickDate').value; if(!d) return
    const day = new Date(d+'T00:00:00+08:00')
    RANGE.start = day; RANGE.end = new Date(day.getTime()+86400000)
    setRangeTitle(`【${fmtDate(day)}】列印信封記錄`)
    await reloadRecords()
  })
  $('#btnSearch').addEventListener('click', ()=> renderTable(filterByKeyword($('#kw').value.trim())))

  // sort buttons
  $('#sortTimeUp').addEventListener('click', ()=>{ sortKey='time'; sortDir='asc'; renderTable(cache) })
  $('#sortTimeDown').addEventListener('click', ()=>{ sortKey='time'; sortDir='desc'; renderTable(cache) })
  $('#sortAddrUp').addEventListener('click', ()=>{ sortKey='addr'; sortDir='asc'; renderTable(cache) })
  $('#sortAddrDown').addEventListener('click', ()=>{ sortKey='addr'; sortDir='desc'; renderTable(cache) })

  $('#btnPrint').addEventListener('click', async ()=>{
    const base = collectForm(false); if(!base) return
    const serial = await nextSerial(base.big)
    const data = { ...base, serial, serialCore: serial.replace(/^B/,'') }
    await saveRecord(data); openPrintPage('print.html', data); clearForm(); previewSerial()
  })
  $('#btnPrintReply').addEventListener('click', async ()=>{
    const base = collectForm(true); if(!base) return
    const serial = await nextSerial(base.big)
    const data = { ...base, serial, serialCore: serial.replace(/^B/,'') }
    await saveRecord(data); openPrintPage('print-reply.html', data); clearForm(); previewSerial()
  })
  $('#btnSaveOnly').addEventListener('click', async ()=>{
    const base = collectForm(false); if(!base) return
    const serial = await nextSerial(base.big)
    const data = { ...base, serial, serialCore: serial.replace(/^B/,'') }
    await saveRecord(data); alert('已儲存紀錄'); clearForm(); previewSerial()
  })

  $('#bigPkg').addEventListener('change', ()=> previewSerial())
}

function previewSerial(){
  const isBig = $('#bigPkg').checked
  const prefix = mmdd(new Date())
  $('#serialPreview').textContent = '今日下一號（預估）：' + (isBig ? ('B'+prefix+'???') : (prefix+'???'))
}

function collectForm(isReply){
  const nickname = $('#nickname').value.trim()
  const big = $('#bigPkg').checked
  const platforms = Array.from(document.querySelectorAll('#platformChips input:checked')).map(i=>i.value)
  const senderCompany = $('#senderCompany').value
  const recvName = $('#recvName').value.trim()
  const recvPhone = $('#recvPhone').value.trim()
  const recvAddr = $('#recvAddr').value.trim()
  const productInfo = $('#productInfo').value.trim()
  if(!nickname) return alert('請填寫來源綽號'), null
  if(!recvName) return alert('請填寫收件人姓名'), null
  if(!recvAddr) return alert('請填寫收件人地址'), null
  const sender = COMPANY[senderCompany]
  const createdBy = me?.displayName || me?.email || '（未登入）'
  let platStr=''; if(platforms.length>0){ platStr = '('+platforms[0] + (platforms.length>1? ('+'+(platforms.length-1)) : '') + ')' }
  let sourceLabel = nickname + platStr; if(isReply) sourceLabel += '(回郵)'
  return {
    type: isReply?'reply':'normal',
    big,
    platforms, nickname, sourceLabel,
    senderCompany,
    senderZh: sender.zh, senderEn: sender.en,
    senderAddr: sender.addr, senderPhone: sender.phone, senderLine: sender.line,
    recvName, recvPhone, recvAddr,
    productInfo: productInfo || '',
    createdBy
  }
}

async function saveRecord(data){
  const col = collection(db, 'envelop-prints')
  await addDoc(col, { ...data, createdAt: serverTimestamp() })
}

function openPrintPage(page, data){
  const qs = new URLSearchParams({
    serial: data.serial || '',
    senderZh: data.senderZh, senderEn: data.senderEn, senderAddr: data.senderAddr,
    senderPhone: data.senderPhone, senderLine: data.senderLine,
    recvName: data.recvName, recvPhone: data.recvPhone || '', recvAddr: data.recvAddr,
    productInfo: data.productInfo || ''
  }).toString()
  window.open(`/${page}?${qs}`, '_blank')
}

function setQuickRange(tag){
  const now = new Date()
  let start = new Date(now)
  if (tag==='1d') start.setDate(now.getDate()-1)
  if (tag==='3d') start.setDate(now.getDate()-3)
  if (tag==='1w') start.setDate(now.getDate()-7)
  if (tag==='1m') start.setMonth(now.getMonth()-1)
  RANGE.start = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  RANGE.end   = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1)
  setRangeTitle(`${fmtDate(RANGE.start)}～${fmtDate(new Date(RANGE.end.getTime()-1))} 列印信封記錄`)
}

function setRangeTitle(text){ $('#rangeTitle').textContent = text }

async function reloadRecords(){
  const col = collection(db, 'envelop-prints')
  const q = query(col, orderBy('createdAt','desc'))
  const snap = await getDocs(q)
  cache = []
  snap.forEach(docSnap=>{
    const d = docSnap.data()
    const t = d.createdAt?.toDate?.() || new Date()
    if (RANGE.start && RANGE.end) {
      if (t < RANGE.start || t >= RANGE.end) return
    }
    cache.push({ id: docSnap.id, ...d, _time: t })
  })
  renderTable(cache)
}

function filterByKeyword(kw){
  if (!kw) return cache
  kw = kw.toLowerCase()
  return cache.filter(r=>{
    const hay = [r.recvName, r.recvPhone, r.recvAddr, r.productInfo].join(' ').toLowerCase()
    return hay.includes(kw)
  })
}

function renderTable(rows){
  const tb = $('#recordsBody'); tb.innerHTML=''
  if (!rows || rows.length===0){
    const tr = el('tr'); const td=el('td','muted'); td.colSpan=7; td.textContent='查無資料'; tr.appendChild(td); tb.appendChild(tr); return
  }
  // 排序
  let arr = rows.slice()
  if (sortKey === 'time') {
    arr.sort((a,b)=> sortDir==='asc' ? a._time - b._time : b._time - a._time)
  } else if (sortKey === 'addr') {
    const norm = s => (s||'').toString().trim()
    arr.sort((a,b)=>{
      const A = norm(a.recvAddr), B = norm(b.recvAddr)
      if (A===B) return 0
      return sortDir==='asc' ? (A<B?-1:1) : (A<B?1:-1)
    })
  }
  arr.forEach(r=>{
    const tr = el('tr')
    const tdTime = el('td')
    const timeBox = el('div','timebox')
    const serialLabel = el('div','serial'); serialLabel.textContent = r.serial || ''
    const timeLabel = el('div','time'); timeLabel.textContent = fmtTime(r._time)
    timeBox.append(serialLabel, timeLabel); tdTime.appendChild(timeBox)

    const tdName = el('td'); tdName.textContent = r.recvName || '-'
    const tdAddr = el('td'); tdAddr.textContent = r.recvAddr || '-'
    const tdPhone = el('td'); tdPhone.textContent = r.recvPhone || '-'
    const tdProd = el('td'); tdProd.textContent = r.productInfo || '-'
    const tdSrc = el('td'); tdSrc.textContent = r.sourceLabel || '-'

    const tdOp = el('td')
    const op = el('div','op')
    const linkReprint = el('a','link'); linkReprint.textContent='補印信封'; linkReprint.href='javascript:void(0)'
    linkReprint.addEventListener('click', ()=>{
      const isReply = r.type==='reply'
      openPrintPage(isReply ? 'print-reply.html' : 'print.html', r)
    })
    op.appendChild(linkReprint); tdOp.appendChild(op)

    tr.append(tdTime, tdName, tdAddr, tdPhone, tdProd, tdSrc, tdOp)
    tb.appendChild(tr)
  })
}

function clearForm(){ ['recvName','recvPhone','recvAddr','productInfo'].forEach(id=> $(('#'+id)).value='') }
