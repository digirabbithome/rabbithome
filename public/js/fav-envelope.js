import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

let favRef
let state = { list: [], filter: '' }

function $(sel){ return document.querySelector(sel) }
function esc(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])) }

async function loadList(){
  const q = query(favRef, orderBy('shortName'))
  const snap = await getDocs(q)
  state.list = snap.docs.map(d=>({ id:d.id, ...d.data() }))
  render()
}

function render(){
  const keyword = state.filter.trim().toLowerCase()
  const rows = state.list.filter(x => {
    if(!keyword) return true
    return [x.shortName,x.name,x.phone,x.address].some(v => (v||'').toLowerCase().includes(keyword))
  })
  $('#countBadge').textContent = String(rows.length)
  const chipRow = $('#chipRow')
  chipRow.innerHTML = rows.map(x=>`<button class="chip" data-id="${x.id}">${esc(x.shortName||'未命名')}</button>`).join('')
  chipRow.querySelectorAll('.chip').forEach(btn=>{
    btn.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-id')
      const item = state.list.find(z=>z.id===id)
      if(!item) return
      fillForm(item)
    })
  })
  const tbody = $('#favTable')
  tbody.innerHTML = rows.map(x=>`
    <tr>
      <td>${esc(x.shortName)}</td>
      <td>${esc(x.name)}</td>
      <td>${esc(x.phone)}</td>
      <td>${esc(x.address)}</td>
      <td><button class="btn ghost btn-edit" data-id="${x.id}">編輯</button></td>
    </tr>`).join('')
  tbody.querySelectorAll('.btn-edit').forEach(btn=>{
    btn.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-id')
      const item = state.list.find(z=>z.id===id)
      if(item) fillForm(item)
    })
  })
}

function fillForm(item){
  $('#docId').value = item.id || ''
  $('#shortName').value = item.shortName || ''
  $('#name').value = item.name || ''
  $('#phone').value = item.phone || ''
  $('#address').value = item.address || ''
  $('#btnDelete').disabled = !item.id
}

function clearForm(){
  fillForm({})
  $('#favForm').reset()
}

async function saveForm(){
  const id = $('#docId').value.trim()
  const data = {
    shortName: $('#shortName').value.trim(),
    name: $('#name').value.trim(),
    phone: $('#phone').value.trim(),
    address: $('#address').value.trim(),
    updatedAt: new Date()
  }
  if(!data.shortName || !data.name){ alert('請填寫「簡稱」與「姓名」'); return }
  if(id){ await updateDoc(doc(favRef, id), data) }
  else{ await addDoc(favRef, { ...data, createdAt: serverTimestamp() }) }
  clearForm()
  await loadList()
}

async function removeCurrent(){
  const id = $('#docId').value.trim()
  if(!id) return
  if(!confirm('確定要刪除這筆常用信封嗎？')) return
  await deleteDoc(doc(favRef, id))
  clearForm()
  await loadList()
}

window.onload = () => {
  onAuthStateChanged(auth, async user => {
    favRef = collection(db, 'favEnvelopes')
    $('#search').addEventListener('input', e => { state.filter = e.target.value; render() })
    $('#btnNew').addEventListener('click', clearForm)
    $('#btnClear').addEventListener('click', clearForm)
    $('#btnDelete').addEventListener('click', removeCurrent)
    $('#favForm').addEventListener('submit', e => { e.preventDefault(); saveForm() })
    await loadList()
  })
}
