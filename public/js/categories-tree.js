// categories-tree.js (guides + safe DnD + orphan repair + bulk show/hide)
import { db } from '/js/firebase.js'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let categories = []

let drag = {
 
  id:null,
  fromParent:null, fromIndex:0,
  overParent:null, overIndex:0, dropType:null,
  hoverTimer:null,
  success:false
}
const HOVER_OPEN_MS = 250

const $ = sel => document.querySelector(sel)
let dropLock = false
const by = f => (a,b)=> f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0

async function load(){
  const ref = collection(db,'categories')
  const snap = await getDocs(ref) // 不下 orderBy
  categories = snap.docs.map(d=> ({ id:d.id, ...d.data() })).map(x=> ({ 
    ...x,
    show: typeof x.show === 'boolean' ? x.show : (typeof x.showOnOrderPage === 'boolean' ? x.showOnOrderPage : false)
  }))
}

async function createRoot(name, code=''){
  const same = categories.filter(c=> (c.parentId||null)===null)
  const order = (same.at(-1)?.order ?? 0) + 1000
  await addDoc(collection(db,'categories'),{ 
    name, code, parentId:null, order, 
    show:false, showOnOrderPage:false,
    createdAt:serverTimestamp(), updatedAt:serverTimestamp() 
  })
}

async function rename(id, name){
  await updateDoc(doc(db,'categories',id), { name, updatedAt:serverTimestamp() })
}

async function toggleShow(id, val){
  await updateDoc(doc(db,'categories',id), { show: !!val, showOnOrderPage: !!val, updatedAt:serverTimestamp() })
}

async function remove(id){ await deleteDoc(doc(db,'categories',id)) }

async function batchUpdate(updates){
  const batch = writeBatch(db)
  updates.forEach(u=> batch.update(doc(db,'categories',u.id), { parentId:u.parentId||null, order:u.order, updatedAt:serverTimestamp() }))
  await batch.commit()
}

// 批次設定 show / showOnOrderPage
async function bulkSetShow(val){
  if(!confirm(val ? '確定「全部顯示」？' : '確定「全部隱藏」？')) return
  const CHUNK = 400
  for(let i=0;i<categories.length;i+=CHUNK){
    const batch = writeBatch(db)
    categories.slice(i,i+CHUNK).forEach(c=>{
      batch.update(doc(db,'categories',c.id), { show: !!val, showOnOrderPage: !!val, updatedAt:serverTimestamp() })
    })
    await batch.commit()
  }
  await load(); render()
}

// ---------- Build tree ----------
function buildTree(arr){
  const map = Object.fromEntries(arr.map(x=>[x.id,x]))
  const roots=[]; arr.forEach(n=> n.children=[])
  arr.forEach(n=>{ if(n.parentId && map[n.parentId]) map[n.parentId].children.push(n); else roots.push(n) })
  const sortRec = nodes=>{ nodes.sort(by(n=>n.order ?? 0)); nodes.forEach(ch=> sortRec(ch.children)) }
  sortRec(roots)
  return {roots, map}
}

function isDescendant(targetId, maybeAncestorId) {
  if (!targetId || !maybeAncestorId) return false
  let cur = categories.find(c => c.id === targetId)
  while (cur && cur.parentId) {
    if (cur.parentId === maybeAncestorId) return true
    cur = categories.find(c => c.id === cur.parentId)
  }
  return false
}

// ---------- Render ----------
function render(){
  const host = $('#treeHost')
  const showGuides = $('#toggleGuides')?.checked
  host.classList.toggle('guides', !!showGuides)

  host.innerHTML = ''
  categories.sort((a,b)=> (a.parentId||'').localeCompare(b.parentId||'') || (a.order??0)-(b.order??0))
  const {roots} = buildTree(categories)
  const ul = document.createElement('ul')
  roots.forEach(n=> ul.appendChild(renderNode(n,0)))
  host.appendChild(ul)
}

function renderNode(node, depth){
  const li = document.createElement('li')
  li.dataset.id = node.id
  li.className = 'tree-node ' + (depth===0 ? 'root':'child') + (node.show ? ' visible':'' )

  const row = document.createElement('div')
  row.className = 'tree-row'
  row.setAttribute('data-depth', depth);
  // JS-controlled indent for broad browser support
  row.style.paddingLeft = `${6 + depth * 20}px`;// ✅ 多層縮排

  // 拖曳：記住來源
  row.draggable = true
  row.addEventListener('dragstart', e=>{
    drag.id = node.id
    drag.success = false
    drag.dropType = null
    drag.fromParent = node.parentId || null
    const same = categories.filter(c=> (c.parentId||null)===drag.fromParent).sort(by(c=>c.order ?? 0))
    drag.fromIndex = same.findIndex(c=> c.id === node.id)
    e.dataTransfer?.setData('text/plain', node.id)
    e.dataTransfer?.setDragImage(row, 10, 10)
  })
  row.addEventListener('dragend', ()=>{
    cleanupDrops()
    if(!drag.success) render() // 還原視圖
    drag = { id:null, fromParent:null, fromIndex:0, overParent:null, overIndex:0, dropType:null, hoverTimer:null, success:false }
  })

  // 目標：li (前/內/後)
  
  li.addEventListener('dragover', e=>{
    e.preventDefault()
    const rect = row.getBoundingClientRect()
    const offset = e.clientY - rect.top
    const topBand = rect.height * 0.15
    const bottomBand = rect.height * 0.85

    li.classList.add('tree-drop')
    li.classList.remove('tree-drop-before','tree-drop-after')

    if(offset < topBand){
      li.classList.add('tree-drop-before')
      drag.dropType = 'before'
      drag.overParent = li.parentElement?.dataset.parentId || null
      drag.overIndex = calcIndex(li, true)
    } else if(offset > bottomBand){
      li.classList.add('tree-drop-after')
      drag.dropType = 'after'
      drag.overParent = li.parentElement?.dataset.parentId || null
      drag.overIndex = calcIndex(li, false)
    } else {
      // Wide middle zone => drop inside
      drag.dropType = 'inside'
      drag.overParent = node.id
      drag.overIndex = 0 // default to top when collapsed
      if(!node._hoverOpenScheduled && node._collapsed){
        node._hoverOpenScheduled = true
        drag.hoverTimer = setTimeout(()=>{ node._collapsed = false; render() }, HOVER_OPEN_MS)
      }
    }
  })
  li.addEventListener('dragleave', ()=>{ li.classList.remove('tree-drop','tree-drop-before','tree-drop-after') })
  
  
  li.addEventListener('drop', async e=>{
    e.preventDefault(); e.stopPropagation(); if(dropLock) return; dropLock = false // release before menu
    cleanupDrops()
    if(drag.hoverTimer){ clearTimeout(drag.hoverTimer); drag.hoverTimer=null }

    const draggedId = drag.id
    if(!draggedId){ dropLock=false; return }

    // 防呆：不能丟到自己或自己的子孫
    if(node.id === draggedId || isDescendant(node.id, draggedId)){
      alert('不能把目錄拖到自己或子孫之下')
      drag.success = false
      dropLock=false
      render()
      return
    }

    const parentIdSame = li.parentElement?.dataset.parentId || null
    const cx = e.clientX, cy = e.clientY

    showDropChoiceMenu({
      li,
      node,
      draggedId,
      clientX: cx,
      clientY: cy,
      applyDropSortFn: (typeof applyDropSort==='function' ? applyDropSort : (typeof window!=='undefined' ? window.applyDropSort : undefined)),
      onPick: undefined,
      onCancel: undefined
    })),
      onPick: undefined,
      onCancel: undefined
    })
  })

  // 顯示勾選
  const chk = document.createElement('input')
  chk.type = 'checkbox'
  chk.checked = !!node.show
  chk.title = '顯示於前台'
  chk.addEventListener('change', async ()=>{ li.classList.toggle('visible', chk.checked); await toggleShow(node.id, chk.checked) })

  // 名稱
  const name = document.createElement('input')
  name.className = 'tree-name tree-input'; name.value = node.name || ''
  name.onchange = async ()=>{ await rename(node.id, name.value); node.name = name.value }

  // 新增子層
  const add = document.createElement('button')
  add.className='tree-btn tree-chip'; add.textContent='＋子层'
  add.onclick = async ()=>{ 
    const nm = prompt('子分類名稱？'); if(!nm) return
    const same = categories.filter(c=> (c.parentId||null)===node.id)
    const order = (same.at(-1)?.order ?? 0) + 1000
    await addDoc(collection(db,'categories'), { name:nm, parentId:node.id, order, show:false, showOnOrderPage:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp() })
    await load(); render()
  }

  // 刪除
  const del = document.createElement('button')
  del.className='tree-btn tree-chip'; del.textContent='刪除'
  del.onclick = async ()=>{ const hasChildren = categories.some(c=> c.parentId===node.id); if(hasChildren){ alert('請先搬移或刪除子分類'); return }; if(confirm(`刪除「${node.name}」？`)){ await remove(node.id); await load(); render() } }

  // 折疊
  const togg = document.createElement('button')
  togg.className = 'tree-btn tree-chip'
  togg.textContent = node._collapsed ? '▸' : '▾'
  togg.title = '展開/收合'
  togg.onclick = ()=>{ node._collapsed = !node._collapsed; render() }

  row.appendChild(togg)
  row.appendChild(chk)
  row.appendChild(name)
  row.appendChild(add)
  row.appendChild(del)
  li.appendChild(row)

  // 子清單
  if(!node._collapsed){
    const ul = document.createElement('ul')
    ul.dataset.parentId = node.id
    ul.addEventListener('dragover', e=>{ e.preventDefault(); e.stopPropagation(); ul.classList.add('tree-drop'); drag.overParent=node.id; drag.overIndex=calcIndexFromY(ul, e.clientY); drag.dropType='inside' })
    ul.addEventListener('dragleave', ()=> ul.classList.remove('tree-drop'))
    ul.addEventListener('drop', async e=>{ e.preventDefault(); e.stopPropagation(); if(dropLock) return; dropLock = true; try {
      await applyDropSort()
    } finally { dropLock = false }
  })
    ;(node.children||[]).forEach(ch=> ul.appendChild(renderNode(ch, depth+1)))
    li.appendChild(ul)
  }
  return li
}


function showDropChoiceMenu({
      li,
      node,
      draggedId,
      clientX: cx,
      clientY: cy,
      applyDropSortFn: (typeof applyDropSort==='function' ? applyDropSort : (typeof window!=='undefined' ? window.applyDropSort : undefined)),
      onPick: undefined,
      onCancel: undefined
    })), onPick: undefined, onCancel: undefined }{
  document.querySelectorAll('.tree-drop-menu').forEach(m=>m.remove())
  const menu = document.createElement('div')
  menu.className = 'tree-drop-menu'

  // Stop outside propagation at the menu container
  menu.addEventListener('click', ev=>{ ev.stopPropagation() }, true)

  const btnBefore = document.createElement('button')
  btnBefore.textContent = '和此同層（前）'
  const btnAfter = document.createElement('button')
  btnAfter.textContent = '和此同層（後）'
  const btnInside = document.createElement('button')
  btnInside.textContent = '到此下層'
  btnInside.classList.add('primary')

  menu.appendChild(btnBefore)
  menu.appendChild(btnAfter)
  menu.appendChild(btnInside)
  document.body.appendChild(menu)

  const x = Math.min(clientX, window.innerWidth - menu.offsetWidth - 12)
  const y = Math.min(clientY, window.innerHeight - menu.offsetHeight - 12)
  menu.style.left = x + 'px'
  menu.style.top = y + 'px'

  const cleanup = ()=>{
    menu.remove()
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onKey)
  }
  const onDocClick = (ev)=>{
    if(!menu.contains(ev.target)) { cleanup(); onCancel && onCancel() }
  }
  const onKey = (ev)=>{
    if(ev.key==='Escape'){ cleanup(); onCancel && onCancel() }
  }
  setTimeout(()=>{
    document.addEventListener('click', onDocClick, true)
    document.addEventListener('keydown', onKey)
  }, 0)

  btnBefore.addEventListener('click', async ev=>{ ev.preventDefault(); cleanup(); await onPick?.('before') })
  btnAfter.addEventListener('click', async ev=>{ ev.preventDefault(); cleanup(); await onPick?.('after') })
  btnInside.addEventListener('click', async ev=>{ ev.preventDefault(); cleanup(); await onPick?.('inside') })
}

function cleanupDrops(){
  document.querySelectorAll('.tree-drop').forEach(el=> el.classList.remove('tree-drop','tree-drop-before','tree-drop-after'))
}

function calcIndexFromY(ul, clientY){
  const items=[...ul.children]; if(items.length===0) return 0;
  for(let i=0;i<items.length;i++){ const r=items[i].getBoundingClientRect(); const mid=r.top + r.height/2; if(clientY < mid) return i }
  return items.length
}

function calcIndex(targetLi, before){
  const ul = targetLi.parentElement; if(!ul) return 0
  const items = [...ul.children]
  let idx = items.indexOf(targetLi)
  if(!before) idx += 1
  return idx
}

async function applyDropSort(){
  cleanupDrops()
  if(drag.hoverTimer){ clearTimeout(drag.hoverTimer); drag.hoverTimer=null }
  const id = drag.id; if(!id) return

  if(!drag.dropType) { drag.success=false; render(); return }
  if(drag.overParent === id || isDescendant(drag.overParent, id)) { 
    alert('不能把目錄拖到自己或子孫之下')
    drag.success=false; render(); return 
  }

  const parentId = drag.overParent || null
  const same = categories
    .filter(c=> (c.parentId||null)===parentId && c.id!==id)
    .sort(by(c=>c.order ?? 0))

  const dragged = categories.find(c=> c.id===id); if(!dragged) return

  dragged.parentId = parentId
  let insertIndex = (drag.dropType==='inside' && (drag.overIndex==null)) ? 0 : drag.overIndex
  insertIndex = Math.min(Math.max(insertIndex ?? same.length, 0), same.length)
  same.splice(insertIndex, 0, dragged)

  const updates = same.map((c,i)=> ({ id:c.id, parentId:c.parentId||null, order:(i+1)*1000 }))
  await batchUpdate(updates)

  drag.success = true
  await load(); render()
}

// ---------- Repair orphans ----------
async function repairOrphans(){
  // parentId 指向不存在者 → 設為 root 並補 order
  const idSet = new Set(categories.map(c=> c.id))
  const orphans = categories.filter(c=> c.parentId && !idSet.has(c.parentId))
  if(orphans.length===0){ alert('沒有發現遺失節點'); return }
  const rootSiblings = categories.filter(c=> (c.parentId||null)===null).sort(by(c=>c.order ?? 0))
  let base = (rootSiblings.at(-1)?.order ?? 0) + 1000

  const batch = writeBatch(db)
  orphans.forEach(o=>{
    batch.update(doc(db,'categories',o.id), { parentId:null, order: base, updatedAt:serverTimestamp() })
    base += 1000
  })
  await batch.commit()
  await load(); render()
}

// ---------- Expand/Collapse ----------
function setAllCollapsed(collapsed){
  const {roots} = buildTree(categories)
  const dfs = nodes=> nodes.forEach(n=>{ n._collapsed = collapsed; dfs(n.children||[]) })
  dfs(roots)
  render()
}

// Boot
window.onload = async ()=>{
  $('#btnAdd').onclick = async ()=>{
    const name = ($('#newName').value||'').trim(); const code = ($('#newCode').value||'').trim()
    if(!name) return alert('請先輸入名稱')
    await createRoot(name, code)
    $('#newName').value=''; $('#newCode').value=''
    await load(); render()
  }
  $('#btnReload').onclick = async ()=>{ await load(); render() }
  $('#btnExpandAll').onclick = ()=> setAllCollapsed(false)
  $('#btnCollapseAll').onclick = ()=> setAllCollapsed(true)
  $('#btnShowAll').onclick = ()=> bulkSetShow(true)
  $('#btnHideAll').onclick = ()=> bulkSetShow(false)
  $('#btnRepair').onclick = ()=> repairOrphans()
  $('#toggleGuides').onchange = ()=> render()

  await load(); render()
}
