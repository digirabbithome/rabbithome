// categories-tree.js v1757744274
import { db } from '/js/firebase.js'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let categories = []
let drag = { id:null, overParent:null, overIndex:0 }
const $ = sel => document.querySelector(sel)
const by = f => (a,b)=> f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0

async function load(){
  const ref = collection(db,'categories')
  const snap = await getDocs(ref)
  categories = snap.docs.map(d=> ({ id:d.id, ...d.data() }))
}

async function createRoot(name, code=''){
  const same = categories.filter(c=> (c.parentId||null)===null)
  const order = (same.at(-1)?.order ?? 0) + 1000
  await addDoc(collection(db,'categories'),{ name, code, parentId:null, order, show:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp() })
}

async function rename(id, name){
  await updateDoc(doc(db,'categories',id), { name, updatedAt:serverTimestamp() })
}

async function toggleShow(id, val){
  await updateDoc(doc(db,'categories',id), { show: !!val, updatedAt:serverTimestamp() })
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
  const sortRec = nodes=>{ nodes.sort(by(n=>n.order ?? 0)); nodes.forEach(ch=> sortRec(ch.children)) }
  sortRec(roots)
  return roots
}

function render(){
  const host = $('#treeHost')
  host.innerHTML = ''
  categories.sort((a,b)=> (a.parentId||'').localeCompare(b.parentId||'') || (a.order??0)-(b.order??0))
  const tree = buildTree(categories)
  const ul = document.createElement('ul')
  ul.style.listStyle='none'; ul.style.padding='8px'; ul.style.margin=0
  tree.forEach(n=> ul.appendChild(renderNode(n,0)))
  host.appendChild(ul)
}

function renderNode(node, depth){
  const li = document.createElement('li')
  li.dataset.id = node.id
  li.className = 'tree-node ' + (depth===0 ? 'root':'child') + (node.show ? ' visible':'' )

  const row = document.createElement('div')
  row.className = 'tree-row' + (depth? ' tree-indent':'')

  const chk = document.createElement('input')
  chk.type = 'checkbox'
  chk.checked = !!node.show
  chk.addEventListener('change', async ()=>{
    li.classList.toggle('visible', chk.checked)
    await toggleShow(node.id, chk.checked)
  })

  const name = document.createElement('input')
  name.className = 'tree-name tree-input'; name.value = node.name || ''
  name.onchange = async ()=>{ await rename(node.id, name.value); node.name = name.value }

  const add = document.createElement('button')
  add.className='tree-btn tree-chip'; add.textContent='＋子層'
  add.onclick = async ()=>{ 
    const nm = prompt('子分類名稱？'); if(!nm) return
    const same = categories.filter(c=> (c.parentId||null)===node.id)
    const order = (same.at(-1)?.order ?? 0) + 1000
    await addDoc(collection(db,'categories'), { name:nm, parentId:node.id, order, show:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp() })
    await load(); render()
  }

  const del = document.createElement('button')
  del.className='tree-btn tree-chip'; del.textContent='刪除'
  del.onclick = async ()=>{
    const hasChildren = categories.some(c=> c.parentId===node.id)
    if(hasChildren){ alert('請先搬移或刪除子分類'); return }
    if(confirm(`刪除「${node.name}」？`)){ await remove(node.id); await load(); render() }
  }

  row.appendChild(chk)
  row.appendChild(name)
  row.appendChild(add)
  row.appendChild(del)
  li.appendChild(row)

  if(node.children?.length){
    const ul = document.createElement('ul')
    ul.style.listStyle='none'; ul.style.margin='4px 0 0'; ul.style.padding=0
    node.children.forEach(ch=> ul.appendChild(renderNode(ch, depth+1)))
    li.appendChild(ul)
  }
  return li
}

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
