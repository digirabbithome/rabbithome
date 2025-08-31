// /js/competitors.js
import { db, auth } from '/js/firebase.js'
import { collection, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const $ = s => document.querySelector(s)
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })
function ymd(d){ return fmt.format(d || new Date()) }

let me

window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return }
    me = user
    bindUI()
    await loadForDate(ymd())
  })
}

function bindUI(){
  const datePicker = $('#datePicker')
  datePicker.value = ymd()
  $('#btnReload').addEventListener('click', () => loadForDate(datePicker.value))
  $('#btnManual').addEventListener('click', manualFetch)

  document.querySelectorAll('#detailTable thead th[data-sort]')
    .forEach(th => th.addEventListener('click', () => sortBy(th.dataset.sort)))
}

async function manualFetch(){
  setStatus('手動擷取中…')
  try{
    const res = await fetch('/api/competitors-fetch', { method:'POST' })
    if(!res.ok) throw new Error('fetch API failed')
    const { date } = await res.json()
    $('#datePicker').value = date
    await loadForDate(date)
    setStatus('手動擷取完成！')
  }catch(err){
    console.error(err)
    setStatus('手動擷取失敗，請查看主控台 / Logs')
  }
}

async function loadForDate(dateStr){
  setStatus('讀取資料中…')
  const dref = doc(collection(db, 'competitors_daily'), dateStr)
  const snap = await getDoc(dref)
  if (!snap.exists()){
    setStatus('尚無資料（可能排程尚未跑或來源無法取得）')
    renderSummary({ date: dateStr, sources: 0, totalItems: 0, totalDelta: 0 })
    renderTop([])
    renderDetail([])
    return
  }
  const data = snap.data()
  renderSummary(data.summary || { date: dateStr, sources: 0, totalItems: 0, totalDelta: 0 })
  renderTop(data.top || [])
  renderDetail(data.items || [])
  setStatus('')
}

function renderSummary(s){
  $('#sumDate').textContent = s.date || '—'
  $('#sumSources').textContent = s.sources ?? '—'
  $('#sumItems').textContent = s.totalItems ?? '—'
  $('#sumDelta').textContent = s.totalDelta ?? '—'
}

function renderTop(list){
  const tbody = $('#topTable tbody')
  tbody.innerHTML = ''
  list.slice(0,10).forEach((it, i) => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${it.source || ''}</td>
      <td>${escapeHtml(it.title || '')}</td>
      <td>${fmtPrice(it.price)}</td>
      <td>${it.delta ?? ''}</td>
      <td><a href="${it.url}" target="_blank">查看</a></td>
    `
    tbody.appendChild(tr)
  })
}

let _detailCache = []
function renderDetail(list){
  _detailCache = list.slice()
  applyFilterAndDraw()
  $('#search').oninput = () => applyFilterAndDraw()
}

let _sortKey = 'delta', _sortDir = 'desc'
function sortBy(key){
  if (_sortKey === key) _sortDir = (_sortDir === 'asc' ? 'desc' : 'asc')
  else { _sortKey = key; _sortDir = 'desc' }
  applyFilterAndDraw()
}

function applyFilterAndDraw(){
  const kw = ($('#search').value || '').trim().toLowerCase()
  let list = _detailCache.filter(it =>
    (it.title || '').toLowerCase().includes(kw) ||
    (it.brand || '').toLowerCase().includes(kw) ||
    (it.note || '').toLowerCase().includes(kw)
  )
  list.sort((a,b)=>{
    const va = a[_sortKey], vb = b[_sortKey]
    if (va === vb) return 0
    if (_sortDir === 'asc') return (va>vb?1:-1)
    return (va<vb?1:-1)
  })

  const tbody = document.querySelector('#detailTable tbody')
  tbody.innerHTML = ''
  list.forEach(it => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${it.source || ''}</td>
      <td>${escapeHtml(it.title || '')}</td>
      <td>${fmtPrice(it.price)}</td>
      <td>${it.sold ?? ''}</td>
      <td>${it.delta ?? ''}</td>
      <td><a href="${it.url}" target="_blank">連結</a></td>
    `
    tbody.appendChild(tr)
  })
}

function setStatus(t){ $('#statusText').textContent = t || '' }
function fmtPrice(n){ if(n==null||isNaN(n)) return ''; return 'NT$'+Number(n).toLocaleString('zh-TW') }
function escapeHtml(s){
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',''':'&#39;'}[c]))
}
