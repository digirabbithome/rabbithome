// categories-tree.js (JS indent + bold root)
import { db } from '/js/firebase.js'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let categories = []

function $(sel){ return document.querySelector(sel) }
const by = f => (a,b)=> f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0

async function load(){
  const ref = collection(db,'categories')
  const snap = await getDocs(ref)
  categories = snap.docs.map(d=> ({ id:d.id, ...d.data() }))
}

async function createRoot(name, code=''){
  const same = categories.filter(c=> (c.parentId||null)===null)
  const order = (same.at(-1)?.order ?? 0) + 1000
  await addDoc(collection(db,'categories'),{ 
    name, code, parentId:null, order, 
    show:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp() 
  })
}

async function rename(id, name){
  await updateDoc(doc(db,'categories',id), { name, updatedAt:serverTimestamp() })
}

async function toggleShow(id, val){
  await updateDoc(doc(db,'categories',id), { show: !!val, updatedAt:serverTimestamp() })
}

async function remove(id){ await deleteDoc(doc(db,'categories',id)) }

function buildTree(arr){
  const map = Object.fromEntries(arr.map(x=>[x.id,x]))
  const roots=[]; arr.forEach(n=> n.children=[])
  arr.forEach(n=>{ if(n.parentId && map[n.parentId]) map[n.parentId].children.push(n); else roots.push(n) })
  const sortRec = nodes=>{ nodes.sort(by(n=>n.order ?? 0)); nodes.forEach(ch=> sortRec(ch.children)) }
  sortRec(roots)
  return {roots}
}

function render(){
  const host = $('#treeHost')
  host.innerHTML = ''
  const {roots} = buildTree(categories)
  const ul = document.createElement('ul')
  roots.forEach(n=> ul.appendChild(renderNode(n,0)))
  host.appendChild(ul)
}

function renderNode(node, depth){
  const li = document.createElement('li')
  li.dataset.id = node.id
  li.className = 'tree-node ' + (depth===0 ? 'root':'child')

  const row = document.createElement('div')
  row.className = 'tree-row'
  row.style.paddingLeft = `${depth*20+6}px`

  const name = document.createElement('input')
  name.className = 'tree-name tree-input'
  name.value = node.name || ''
  if(depth===0){ name.style.fontWeight = 'bold' } // 根層粗體
  name.onchange = async ()=>{ await rename(node.id, name.value) }

  row.appendChild(name)
  li.appendChild(row)

  if(node.children && node.children.length){
    const ul = document.createElement('ul')
    node.children.forEach(ch=> ul.appendChild(renderNode(ch, depth+1)))
    li.appendChild(ul)
  }
  return li
}

window.onload = async ()=>{
  $('#btnAdd').onclick = async ()=>{
    const name = ($('#newName').value||'').trim()
    if(!name) return alert('請先輸入名稱')
    await createRoot(name)
    $('#newName').value=''
    await load(); render()
  }
  $('#btnReload').onclick = async ()=>{ await load(); render() }
  await load(); render()
}
