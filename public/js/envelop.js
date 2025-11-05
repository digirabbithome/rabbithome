// envelop.js — clean r5 patch (ESM). Uses db/auth from /js/firebase.js.
// Features: bigPkg checkbox, daily serials (B for big), print pages, list with sort by time/address.

import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, query, orderBy, getDocs, setDoc, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

var me = null
var RANGE = { start: null, end: null }
var cache = []
var sortKey = 'time'    // 'time' | 'addr'
var sortDir = 'desc'    // 'asc'  | 'desc'

function $(sel, root){ return (root||document).querySelector(sel) }
function el(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e }
var TPE = 'Asia/Taipei'

function fmtDate(d){
  return new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, year:'numeric', month:'2-digit', day:'2-digit' }).format(d)
}
function fmtTime(d){
  return new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' }).format(d)
}
function mmdd(d){ var m=String(d.getMonth()+1).padStart(2,'0'); var dd=String(d.getDate()).padStart(2,'0'); return m+dd }
function ymd(d){ var y=d.getFullYear(); var m=String(d.getMonth()+1).padStart(2,'0'); var dd=String(d.getDate()).padStart(2,'0'); return y+'-'+m+'-'+dd }

async function nextSerial(isBig){
  var today = new Date()
  var id = ymd(today) + '-' + (isBig ? 'big' : 'normal')
  var ref = doc(db, 'envelop-counters', id)
  try{
    var snap = await getDoc(ref)
    var last = 0
    if (snap.exists()) last = Number((snap.data() && snap.data().last) || 0)
    var next = last + 1
    await setDoc(ref, { date: ymd(today), type: (isBig?'big':'normal'), last: next, updatedAt: serverTimestamp() }, { merge: true })
    var core = mmdd(today) + String(next).padStart(3,'0')
    return isBig ? ('B'+core) : core
  }catch(e){
    // fallback local
    var key = 'envctr-'+id
    var last2 = Number(localStorage.getItem(key) || '0') + 1
    localStorage.setItem(key, String(last2))
    var core2 = mmdd(today) + String(last2).padStart(3,'0')
    return isBig ? ('B'+core2) : core2
  }
}

function setQuickRange(tag){
  var now = new Date()
  var start = new Date(now.getTime())
  if (tag==='1d') start.setDate(now.getDate()-1)
  if (tag==='3d') start.setDate(now.getDate()-3)
  if (tag==='1w') start.setDate(now.getDate()-7)
  if (tag==='1m') start.setMonth(now.getMonth()-1)
  RANGE.start = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  RANGE.end   = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1)
  setRangeTitle(fmtDate(RANGE.start)+'～'+fmtDate(new Date(RANGE.end.getTime()-1))+' 列印信封記錄')
}

function setRangeTitle(text){ var t=$('#rangeTitle'); if(t) t.textContent=text }

function collectForm(isReply){
  var nickname = ($('#nickname')||{}).value || ''
  nickname = nickname.trim()
  var big = ($('#bigPkg') && $('#bigPkg').checked) ? true : false
  var chips = Array.prototype.slice.call(document.querySelectorAll('#platformChips input:checked'))
  var platforms = chips.map(function(i){ return i.value })
  var senderCompany = ($('#senderCompany')||{}).value || 'rabbit'
  var recvName = ($('#recvName')||{}).value || ''
  recvName = recvName.trim()
  var recvPhone = ($('#recvPhone')||{}).value || ''
  var recvAddr = ($('#recvAddr')||{}).value || ''
  recvAddr = recvAddr.trim()
  var productInfo = ($('#productInfo')||{}).value || ''

  if (!nickname){ alert('請填寫來源綽號'); return null }
  if (!recvName){ alert('請填寫收件人姓名'); return null }
  if (!recvAddr){ alert('請填寫收件人地址'); return null }

  var SENDER = {
    rabbit:{ zh:'數位小兔', en:'Digital Rabbit Co.', addr:'', phone:'', line:'@digitalrabbit' },
    focus:{ zh:'聚焦數位', en:'Focus Digital Co.', addr:'', phone:'', line:'@focus' },
    nosleep:{ zh:'免睡攝影', en:'No Sleep Studio', addr:'', phone:'', line:'@nosleep' },
    other:{ zh:'其他', en:'Other Sender', addr:'', phone:'', line:'' }
  }
  var sender = SENDER[senderCompany] || SENDER.rabbit
  var createdBy = (me && (me.displayName || me.email)) || '（未登入）'
  var platStr = ''
  if (platforms.length>0){
    platStr = '('+platforms[0] + (platforms.length>1 ? ('+'+(platforms.length-1)) : '') + ')'
  }
  var sourceLabel = nickname + platStr
  if (isReply) sourceLabel += '(回郵)'

  return {
    type: isReply ? 'reply' : 'normal',
    big: big,
    platforms: platforms, nickname: nickname, sourceLabel: sourceLabel,
    senderCompany: senderCompany,
    senderZh: sender.zh, senderEn: sender.en,
    senderAddr: sender.addr, senderPhone: sender.phone, senderLine: sender.line,
    recvName: recvName, recvPhone: recvPhone, recvAddr: recvAddr,
    productInfo: productInfo, createdBy: createdBy
  }
}

async function saveRecord(data){
  var col = collection(db, 'envelop-prints')
  await addDoc(col, Object.assign({}, data, { createdAt: serverTimestamp() }))
}

function openPrintPage(page, data){
  var qs = new URLSearchParams({
    serial: data.serial || '',
    senderZh: data.senderZh, senderEn: data.senderEn, senderAddr: data.senderAddr,
    senderPhone: data.senderPhone, senderLine: data.senderLine,
    recvName: data.recvName, recvPhone: data.recvPhone || '', recvAddr: data.recvAddr,
    productInfo: data.productInfo || ''
  }).toString()
  window.open('/'+page+'?'+qs, '_blank')
}

function filterByKeyword(kw){
  if (!kw) return cache
  kw = kw.toLowerCase()
  return cache.filter(function(r){
    var hay = [r.recvName, r.recvPhone, r.recvAddr, r.productInfo].join(' ').toLowerCase()
    return hay.indexOf(kw) >= 0
  })
}

async function reloadRecords(){
  var col = collection(db, 'envelop-prints')
  var q = query(col, orderBy('createdAt','desc'))
  var snap = await getDocs(q)
  cache = []
  snap.forEach(function(docSnap){
    var d = docSnap.data()
    var t = (d.createdAt && d.createdAt.toDate && d.createdAt.toDate()) || new Date()
    if (RANGE.start && RANGE.end){
      if (t < RANGE.start || t >= RANGE.end) return
    }
    var row = {}; for (var k in d){ row[k]=d[k] }
    row._time = t; row.id = docSnap.id
    cache.push(row)
  })
  renderTable(cache)
}

function renderTable(rows){
  var tb = $('#recordsBody'); if (!tb) return
  tb.innerHTML=''
  if (!rows || rows.length===0){
    var tr0 = el('tr'); var td0=el('td','muted'); td0.colSpan=7; td0.textContent='查無資料'; tr0.appendChild(td0); tb.appendChild(tr0); return
  }
  var arr = rows.slice()
  if (sortKey==='addr'){
    arr.sort(function(a,b){
      var A = (a.recvAddr||'').trim(); var B = (b.recvAddr||'').trim()
      if (A===B) return 0
      return sortDir==='asc' ? (A<B?-1:1) : (A<B?1:-1)
    })
  }else{
    arr.sort(function(a,b){
      return sortDir==='asc' ? (a._time - b._time) : (b._time - a._time)
    })
  }
  arr.forEach(function(r){
    var tr = el('tr')
    var tdTime = el('td')
    var box = el('div','timebox')
    var s1 = el('div','serial'); s1.textContent = r.serial || ''
    var s2 = el('div','time');   s2.textContent = fmtTime(r._time)
    box.appendChild(s1); box.appendChild(s2); tdTime.appendChild(box)

    var tdName = el('td'); tdName.textContent = r.recvName || '-'
    var tdAddr = el('td'); tdAddr.textContent = r.recvAddr || '-'
    var tdPhone = el('td'); tdPhone.textContent = r.recvPhone || '-'
    var tdProd = el('td'); tdProd.textContent = r.productInfo || '-'
    var tdSrc  = el('td'); tdSrc.textContent  = r.sourceLabel || '-'

    var tdOp = el('td')
    var link = el('a','link'); link.href='javascript:void(0)'; link.textContent='補印信封'
    link.addEventListener('click', function(){
      var isReply = r.type==='reply'
      openPrintPage(isReply ? 'print-reply.html' : 'print.html', r)
    })
    tdOp.appendChild(link)

    tr.appendChild(tdTime); tr.appendChild(tdName); tr.appendChild(tdAddr)
    tr.appendChild(tdPhone); tr.appendChild(tdProd); tr.appendChild(tdSrc); tr.appendChild(tdOp)
    tb.appendChild(tr)
  })
}

function previewSerial(){
  var isBig = ($('#bigPkg') && $('#bigPkg').checked) ? true : false
  var prefix = mmdd(new Date())
  var t = $('#serialPreview'); if (t){ t.textContent = '今日下一號（預估）：' + (isBig ? ('B'+prefix+'???') : (prefix+'???')) }
}

function clearForm(){
  var ids=['recvName','recvPhone','recvAddr','productInfo']
  ids.forEach(function(id){ var e=document.getElementById(id); if(e) e.value='' })
}

window.onload = async function (){
  onAuthStateChanged(auth, function(u){ me = u || null })

  // UI binds
  var bNew = $('#btnNew'); if (bNew) bNew.addEventListener('click', function(){
    var f=$('#formSection'), l=$('#listSection'); if(f) f.classList.remove('hidden'); if(l) l.classList.add('hidden'); previewSerial()
  })
  var bList = $('#btnList'); if (bList) bList.addEventListener('click', async function(){
    var f=$('#formSection'), l=$('#listSection'); if(f) f.classList.add('hidden'); if(l) l.classList.remove('hidden'); await reloadRecords()
  })

  document.querySelectorAll('[data-range]').forEach(function(b){
    b.addEventListener('click', async function(){
      setQuickRange(b.getAttribute('data-range')); await reloadRecords()
    })
  })
  var bPick = $('#btnPickDay'); if (bPick) bPick.addEventListener('click', async function(){
    var d = ($('#pickDate')||{}).value; if(!d) return
    var day = new Date(d+'T00:00:00+08:00')
    RANGE.start = day; RANGE.end = new Date(day.getTime()+86400000)
    setRangeTitle('【'+fmtDate(day)+'】列印信封記錄')
    await reloadRecords()
  })
  var bSearch = $('#btnSearch'); if (bSearch) bSearch.addEventListener('click', function(){
    var kw = ($('#kw')||{}).value || ''
    renderTable(filterByKeyword(kw.trim()))
  })

  var up = $('#sortTimeUp'); if (up) up.addEventListener('click', function(){ sortKey='time'; sortDir='asc'; renderTable(cache) })
  var down = $('#sortTimeDown'); if (down) down.addEventListener('click', function(){ sortKey='time'; sortDir='desc'; renderTable(cache) })
  var au = $('#sortAddrUp'); if (au) au.addEventListener('click', function(){ sortKey='addr'; sortDir='asc'; renderTable(cache) })
  var ad = $('#sortAddrDown'); if (ad) ad.addEventListener('click', function(){ sortKey='addr'; sortDir='desc'; renderTable(cache) })

  var bPrint = $('#btnPrint'); if (bPrint) bPrint.addEventListener('click', async function(){
    var base = collectForm(false); if(!base) return
    var serial = await nextSerial(base.big)
    var data = Object.assign({}, base, { serial: serial, serialCore: serial.replace(/^B/, '') })
    await saveRecord(data); openPrintPage('print.html', data); clearForm(); previewSerial()
  })
  var bReply = $('#btnPrintReply'); if (bReply) bReply.addEventListener('click', async function(){
    var base = collectForm(true); if(!base) return
    var serial = await nextSerial(base.big)
    var data = Object.assign({}, base, { serial: serial, serialCore: serial.replace(/^B/, '') })
    await saveRecord(data); openPrintPage('print-reply.html', data); clearForm(); previewSerial()
  })
  var bSave = $('#btnSaveOnly'); if (bSave) bSave.addEventListener('click', async function(){
    var base = collectForm(false); if(!base) return
    var serial = await nextSerial(base.big)
    var data = Object.assign({}, base, { serial: serial, serialCore: serial.replace(/^B/, '') })
    await saveRecord(data); alert('已儲存紀錄'); clearForm(); previewSerial()
  })

  var big = $('#bigPkg'); if (big) big.addEventListener('change', previewSerial)

  // initial
  var f=$('#formSection'), l=$('#listSection')
  if (f) f.classList.remove('hidden')
  if (l) l.classList.remove('hidden')  // 讓你立刻看到列表（依你原畫面習慣）
  setQuickRange('3d')
  await reloadRecords()
  previewSerial()
}
