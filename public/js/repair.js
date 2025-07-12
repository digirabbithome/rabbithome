
import { db } from '/js/firebase.js'
import {
  collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let repairData = []
let sortField = 'createdAt'
let sortDirection = 'desc'
let currentPage = 1
const pageSize = 50
let currentFilter = ['2', '3']

const nickname = localStorage.getItem('nickname') || '未登入'

function renderTable() {
  const listDiv = document.getElementById('repair-list')
  const keyword1 = document.getElementById('search-id')?.value.trim().toLowerCase() || ''
  const keyword2 = document.getElementById('search-keyword')?.value.trim().toLowerCase() || ''

  let filtered = repairData.filter(d => {
    const match1 = d.repairId?.toLowerCase().includes(keyword1)
    const match2 = [d.customer, d.phone, d.address, d.supplier, d.product, d.description]
      .some(field => field?.toLowerCase().includes(keyword2))
    const matchStatus = currentFilter.includes(String(d.status))
    return match1 && match2 && matchStatus
  })

  // 分頁處理
  const totalPages = Math.ceil(filtered.length / pageSize)
  currentPage = Math.min(currentPage, totalPages || 1)
  const startIdx = (currentPage - 1) * pageSize
  const paginated = filtered.slice(startIdx, startIdx + pageSize)

  // 排序
  paginated.sort((a, b) => {
    let valA = a[sortField], valB = b[sortField]
    if (valA?.toDate) valA = valA.toDate()
    if (valB?.toDate) valB = valB.toDate()
    if (typeof valA === 'string') valA = valA.toLowerCase()
    if (typeof valB === 'string') valB = valB.toLowerCase()
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const arrow = sortDirection === 'asc' ? '▲' : '▼'
  let html = `<table><thead><tr>
    <th data-sort="createdAt">送修時間 ${sortField==='createdAt'?arrow:''}</th>
    <th data-sort="repairId">維修單號 ${sortField==='repairId'?arrow:''}</th>
    <th data-sort="customer">姓名 ${sortField==='customer'?arrow:''}</th>
    <th data-sort="supplier">廠商 ${sortField==='supplier'?arrow:''}</th>
    <th data-sort="product">商品 ${sortField==='product'?arrow:''}</th>
    <th data-sort="description">描述 ${sortField==='description'?arrow:''}</th>
    <th data-sort="status">狀態 ${sortField==='status'?arrow:''}</th>
    <th data-sort="diff">維修天數 ${sortField==='diff'?arrow:''}</th>
    <th>編輯</th></tr></thead><tbody>`

  paginated.forEach(d => {
    if (!d.repairId) return;
    const createdAt = d.createdAt?.toDate?.()
    const dateStr = createdAt ? `${createdAt.getFullYear()}/${createdAt.getMonth()+1}/${createdAt.getDate()}` : ''
    const diff = createdAt ? Math.floor((new Date() - createdAt) / (1000*60*60*24)) : 0
    const redClass = diff > 7 ? 'style="background:#faa"' : ''
    const desc = d.description?.slice(0,15) + (d.description?.length > 15 ? '…' : '')
    const statusText = ['❓','新進','已交廠商','完成','已取貨'][d.status] || '❓'

    const iconList = []
    if (d.status === 1) iconList.push({ icon: '➡️', next: 2 }, { icon: '✅', next: 3 }, { icon: '↩️', next: 3 })
    else if (d.status === 2) iconList.push({ icon: '✅', next: 3 }, { icon: '↩️', next: 3 })
    else if (d.status === 3) iconList.push({ icon: '📦', next: 4 })

    let iconHtml = ''
    iconList.forEach(({ icon, next }) => {
      iconHtml += `<span class="status-btn" data-id="${d.repairId}" data-next="${next}" style="cursor:pointer">${icon}</span> `
    })

    html += `<tr>
      <td>${dateStr}</td>
      <td>${d.repairId}</td>
      <td>${d.customer}</td>
      <td>${(d.supplier || '').substring(0,4)}</td>
      <td>${d.product}</td>
      <td>${desc}</td>
      <td>${statusText}</td>
      <td ${redClass}>${diff}</td>
      <td>${iconHtml}</td></tr>`
  })

  html += '</tbody></table>'

  // 分頁區塊
  html += `<div style="margin-top:1em;text-align:center">`
  if (currentPage > 1) html += `<button onclick="changePage(${currentPage-1})">⬅️ 上一頁</button> `
  html += `第 ${currentPage} / ${totalPages || 1} 頁`
  if (currentPage < totalPages) html += ` <button onclick="changePage(${currentPage+1})">下一頁 ➡️</button>`
  html += '</div>'

  listDiv.innerHTML = html

  // 點欄位排序
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.onclick = () => {
      const field = th.dataset.sort
      if (sortField === field) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      else { sortField = field; sortDirection = 'asc' }
      renderTable()
    }
  })

  // 狀態變更
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.onclick = async () => {
      let repairId = btn.dataset.id;
      if (!repairId || repairId === 'undefined') {
        alert('⚠️ 此筆資料 repairId 無效，請確認資料庫！')
        console.warn('❌ 錯誤 repairId：', btn.dataset)
        return;
      }
      console.log('🛠️ 正在更新 repairId:', repairId);
      const repairId = btn.dataset.id
      const newStatus = parseInt(btn.dataset.next)
      const ref = doc(db, 'repairs', repairId)
      await updateDoc(ref, {
        status: newStatus,
        [`history.${newStatus}`]: {
          user: nickname,
          time: new Date().toISOString()
        }
      })
      alert(`✅ 狀態更新為 ${newStatus}！`)
      loadData()
    }
  })
}

window.changePage = p => { currentPage = p; renderTable() }

window.onload = async () => {
  document.querySelectorAll('.status-filter').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.status-filter').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const s = btn.dataset.status
      currentFilter = s === 'all' ? ['1','2','3','4'] :
                      s === 'new' ? ['1'] :
                      s === 'vendor' ? ['2'] :
                      s === 'done' ? ['3'] :
                      s === 'finish' ? ['4'] :
                      ['1','2']
      currentPage = 1
      renderTable()
    }
  })
  await loadData()
}

async function loadData() {
  const q = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  repairData = snap.docs.map(doc => { const data = doc.data(); if (!doc.id) return null; return { ...data, repairId: doc.id }; }).filter(x => x)
  renderTable()
}
