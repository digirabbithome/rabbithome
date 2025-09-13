import { db } from '/js/firebase.js'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let categories = []
let drag = { id:null, overParent:null, overIndex:0 }
const $ = sel => document.querySelector(sel)
const by = f => (a,b)=> f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0

async function load(){
  const q = query(collection(db,'categories'), orderBy('parentId'), orderBy('order'))
  const snap = await getDocs(q)
  categories = snap.docs.map(d=> ({ id:d.id, ...d.data() }))
}

async function createRoot(name, code=''){
  const same = categories.filter(c=> (c.parentId||null)===null)
  const order = (same.at(-1)?.order ?? 0) + 1000
  await addDoc(collection(db,'categories'),{ name, code, parentId:null, order, createdAt:serverTimestamp(), updatedAt:serverTimestamp() })
}

async function rename(id, name){
  await updateDoc(doc(db,'categories',id), { name, updatedAt:serverTimestamp() })
}

async function remove(id){ await deleteDoc(doc(db,'categories',id)) }

async function batchUpdate(updates){
  const batch = writeBatch(db)
  updates.forEach(u=> batch.update(doc(db,'categories',u.id), { parentId:u.parentId||null, order:u.order, updatedAt:serverTimestamp() }))
  await batch.commit()
}

function buildTree(arr){
  const map = Object.fromEntries(arr.map(x=>[x.id,x]))
  const roots=[]; arr.forEach(n=> n.children=[])
  arr.forEach(n=>{ if(n.parentId && map[n.parentId]) map[n.parentId].children.push(n); else roots.push(n) })
  const sortRec = nodes=>{ nodes.sort(by(n=>n.order)); nodes.forEach(ch=> sortRec(ch.children)) }
  sortRec(roots)
  return roots
}

function render(){
  const host = $('#treeHost')
  host.innerHTML = ''
  const tree = buildTree(categories)
  const ul = document.createElement('ul')
  ul.style.listStyle='none'; ul.style.padding='8px'; ul.style.margin=0
  tree.forEach(n=> ul.appendChild(renderNode(n,0)))
  host.appendChild(ul)
}

function renderNode(node, depth){
  const li = document.createElement('li')
  li.dataset.id = node.id
  const row = document.createElement('div')
  row.className = 'tree-row' + (depth? ' tree-indent':'')
  const togg = document.createElement('button')
  togg.className = 'tree-btn'; togg.textContent = node._collapsed ? '▸' : '▾'; togg.title='展開/收合'
  togg.onclick = ()=>{ node._collapsed=!node._collapsed; render() }
  const name = document.createElement('input')
  name.className = 'tree-name tree-input'; name.value = node.name || ''
  name.onchange = async ()=>{ await rename(node.id, name.value); node.name = name.value }
  const add = document.createElement('button')
  add.className='tree-btn'; add.textContent='＋子層'
  add.onclick = async ()=>{
    const nm = prompt('子分類名稱？'); if(!nm) return
    const same = categories.filter(c=> (c.parentId||null)===node.id)
    const order = (same.at(-1)?.order ?? 0) + 1000
    await addDoc(collection(db,'categories'), { name:nm, parentId:node.id, order, createdAt:serverTimestamp(), updatedAt:serverTimestamp() })
    await load(); render()
  }
  const del = document.createElement('button')
  del.className='tree-btn'; del.textContent='刪除'
  del.onclick = async ()=>{
    const hasChildren = categories.some(c=> c.parentId===node.id)
    if(hasChildren){ alert('請先搬移或刪除子分類'); return }
    if(confirm(`刪除「${node.name}」？`)){ await remove(node.id); await load(); render() }
  }
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
  row.appendChild(togg); row.appendChild(name); row.appendChild(add); row.appendChild(del)
  li.appendChild(row)
  if(!node._collapsed){
    const ul = document.createElement('ul')
    ul.style.listStyle='none'; ul.style.margin='4px 0 0'; ul.style.padding=0
    ul.dataset.parentId = node.id
    ul.addEventListener('dragover', e=>{ e.preventDefault(); ul.classList.add('tree-drop'); drag.overParent=node.id; drag.overIndex=ul.children.length })
    ul.addEventListener('dragleave', ()=> ul.classList.remove('tree-drop'))
    ul.addEventListener('drop', async e=>{ e.preventDefault(); await applyDropSort() })
    node.children.forEach(ch=> ul.appendChild(renderNode(ch, depth+1)))
    li.appendChild(ul)
  }
  return li
}

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
  const same = categories.filter(c=> (c.parentId||null)===parentId).filter(c=> c.id!==id).sort(by(c=>c.order))
  const dragged = categories.find(c=> c.id===id); if(!dragged) return
  dragged.parentId = parentId
  same.splice(drag.overIndex, 0, dragged)
  const updates = same.map((c,i)=> ({ id:c.id, parentId:c.parentId||null, order:(i+1)*1000 }))
  await batchUpdate(updates)
  await load(); render()
}

window.onload = async ()=>{
  $('#btnAdd').onclick = async ()=>{
    const name = ($('#newName').value||'').trim(); const code = ($('#newCode')?.value||'').trim()
    if(!name) return alert('請先輸入名稱')
    await createRoot(name, code)
    $('#newName').value=''; if($('#newCode')) $('#newCode').value=''
    await load(); render()
  }
  $('#btnReload').onclick = async ()=>{ await load(); render() }
  await load(); render()
}