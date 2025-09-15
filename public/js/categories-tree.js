// categories-tree.js v1757954847 (merged: DnD + show compat + no-index)
import { db } from '/js/firebase.js'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let categories = []
let drag = { id:null, overParent:null, overIndex:0 }
const $ = sel => document.querySelector(sel)
const by = f => (a,b)=> f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0

// ---------- Data ----------
async function load(){
  const ref = collection(db,'categories')
  const snap = await getDocs(ref) // 不加 orderBy，避免索引需求
  categories = snap.docs.map(d=> ({ id:d.id, ...d.data() })).map(x=> ({ 
    ...x,
    // 相容舊欄位 showOnOrderPage
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

// ---------- Build tree ----------
function buildTree(arr){
  const map = Object.fromEntries(arr.map(x=>[x.id,x]))
  const roots=[]; arr.forEach(n=> n.children=[])
  arr.forEach(n=>{ if(n.parentId && map[n.parentId]) map[n.parentId].children.push(n); else roots.push(n) })
  const sortRec = nodes=>{ nodes.sort(by(n=>n.order ?? 0)); nodes.forEach(ch=> sortRec(ch.children)) }
  sortRec(roots)
  return roots
}

// ---------- Render ----------
function render(){
  const host = $('#treeHost')
  host.innerHTML = ''
  // 前端排序：parentId -> order
  categories.sort((a,b)=> (a.parentId||'').localeCompare(b.parentId||'') || (a.order??0)-(b.order??0))
  const tree = buildTree(categories)
  const ul = document.createElement('ul')
  tree.forEach(n=> ul.appendChild(renderNode(n,0)))
  host.appendChild(ul)
}

function renderNode(node, depth){
  const li = document.createElement('li')
  li.dataset.id = node.id
  li.className = 'tree-node ' + (depth===0 ? 'root':'child') + (node.show ? ' visible':'' )

  // --- row ---
  const row = document.createElement('div')
  row.className = 'tree-row' + (depth? ' tree-indent':'')

  // DnD
  row.draggable = true
  row.addEventListener('dragstart', e=>{
    drag.id = node.id
    e.dataTransfer?.setData('text/plain', node.id)
    e.dataTransfer?.setDragImage(row, 10, 10)
  })
  row.addEventListener('dragend', ()=>{ document.querySelectorAll('.tree-drop').forEach(el=> el.classList.remove('tree-drop')); drag = { id:null, overParent:null, overIndex:0 } })

  li.addEventListener('dragover', e=>{
    e.preventDefault()
    const rect = li.getBoundingClientRect()
    const before = (e.clientY - rect.top) < rect.height/2
    li.classList.add('tree-drop')
    drag.overParent = li.parentElement?.dataset.parentId || null
    drag.overIndex = calcIndex(li, before)
  })
  li.addEventListener('dragleave', ()=> li.classList.remove('tree-drop'))
  li.addEventListener('drop', async e=>{ e.preventDefault(); await applyDropSort() })

  // 顯示勾選
  const chk = document.createElement('input')
  chk.type = 'checkbox'
  chk.checked = !!node.show
  chk.title = '顯示於前台'
  chk.addEventListener('change', async ()=>{ li.classList.toggle('visible', chk.checked); await toggleShow(node.id, chk.checked) })

  // 名稱（inline rename）
  const name = document.createElement('input')
  name.className = 'tree-name tree-input'; name.value = node.name || ''
  name.onchange = async ()=>{ await rename(node.id, name.value); node.name = name.value }

  // 新增子層
  const add = document.createElement('button')
  add.className='tree-btn tree-chip'; add.textContent='＋子層'
  add.onclick = async ()=>{ 
    const nm = prompt('子分類名稱？'); if(!nm) return
    const same = categories.filter(c=> (c.parentId||null)===node.id)
    const order = (same.at(-1)?.order ?? 0) + 1000
    await addDoc(collection(db,'categories'), { name:nm, parentId:node.id, order, show:false, showOnOrderPage:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp() })
    await load(); render()
  }

  // 刪除（無子才可）
  const del = document.createElement('button')
  del.className='tree-btn tree-chip'; del.textContent='刪除'
  del.onclick = async ()=>{ const hasChildren = categories.some(c=> c.parentId===node.id); if(hasChildren){ alert('請先搬移或刪除子分類'); return }; if(confirm(`刪除「${node.name}」？`)){ await remove(node.id); await load(); render() } }

  row.appendChild(chk)
  row.appendChild(name)
  row.appendChild(add)
  row.appendChild(del)
  li.appendChild(row)

  // 子清單（可掉入變成其子）
  if(!node._collapsed){
    const ul = document.createElement('ul')
    ul.dataset.parentId = node.id
    ul.addEventListener('dragover', e=>{ e.preventDefault(); ul.classList.add('tree-drop'); drag.overParent=node.id; drag.overIndex=ul.children.length })
    ul.addEventListener('dragleave', ()=> ul.classList.remove('tree-drop'))
    ul.addEventListener('drop', async e=>{ e.preventDefault(); await applyDropSort() })
    ;(node.children||[]).forEach(ch=> ul.appendChild(renderNode(ch, depth+1)))
    li.appendChild(ul)
  }
  return li
}

// ---------- DnD helpers ----------
function calcIndex(targetLi, before){
  const ul = targetLi.parentElement; if(!ul) return 0
  const items = [...ul.children]
  let idx = items.indexOf(targetLi)
  if(!before) idx += 1
  return idx
}

async function applyDropSort(){
  document.querySelectorAll('.tree-drop').forEach(el=> el.classList.remove('tree-drop'))
  const id = drag.id; if(!id) return
  const parentId = drag.overParent || null
  const same = categories.filter(c=> (c.parentId||null)===parentId).filter(c=> c.id!==id).sort(by(c=>c.order ?? 0))
  const dragged = categories.find(c=> c.id===id); if(!dragged) return
  dragged.parentId = parentId
  same.splice(drag.overIndex, 0, dragged)
  const updates = same.map((c,i)=> ({ id:c.id, parentId:c.parentId||null, order:(i+1)*1000 }))
  await batchUpdate(updates)
  await load(); render()
}

// ---------- Boot ----------
window.onload = async ()=>{
  $('#btnAdd').onclick = async ()=>{
    const name = ($('#newName').value||'').trim(); const code = ($('#newCode').value||'').trim()
    if(!name) return alert('請先輸入名稱')
    await createRoot(name, code)
    $('#newName').value=''; $('#newCode').value=''
    await load(); render()
  }
  $('#btnReload').onclick = async ()=>{ await load(); render() }
  await load(); render()
}
