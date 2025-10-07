// Rabbithome Floating Chat Widget v1.8.1 — DM only + per-user & total unread badges + unread-first sorting
import { db, auth } from '/js/firebase.js'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot,
  serverTimestamp, query, where, orderBy, limit, deleteDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const TPE='Asia/Taipei'
const fmtTime=new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' })

let me=null, unsubRoom=null, stopRoomsSnapshot=null
const state={ roomId:null, users:[], dmTarget:null, unreadTotal:0 }

const $=(s,r=document)=>r.querySelector(s)
const el=(t,c)=>{ const e=document.createElement(t); if(c) e.className=c; return e }
const myNick = () => me?.displayName || (me?.email ? me.email.split('@')[0] : '我')

function ensureDOM(){
  if(document.querySelector('.rh-chat-fab')) return
  const fab=el('div','rh-chat-fab')
  fab.innerHTML='💬<span class="badge" id="rhChatBadge">0</span>'
  fab.title='開啟聊天室'
  const panel=el('div','rh-chat-panel')
  panel.innerHTML=`
    <div class="rh-chat-header">
      <div class="rh-chat-tabs">
        <div class="rh-tab active" data-tab="dm">私訊</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span id="rhMeName" style="font-size:12px;color:#6b7280"></span>
        <button id="rhClose" style="border:none;background:#fff;border-radius:8px;padding:4px 8px;cursor:pointer">✕</button>
      </div>
    </div>
    <div class="rh-chat-body">
      <div class="rh-chat-sidebar" id="rhSidebar"></div>
      <div class="rh-chat-main">
        <div id="rhMsgs" class="rh-msgs"></div>
        <div class="rh-input">
          <input id="rhText" placeholder="輸入訊息..." />
          <button id="rhSend">送出</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(fab); document.body.appendChild(panel)

  fab.addEventListener('click',()=> toggle(true))
  $('#rhClose',panel).addEventListener('click',()=>toggle(false))
  $('#rhSend',panel).addEventListener('click',sendCurrent)
  $('#rhText',panel).addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); sendCurrent() } })
}

function toggle(open){
  const p=$('.rh-chat-panel'); if(!p) return
  p.style.display=open?'block':'none'
  if(open && state.roomId) markRoomRead(state.roomId)
}

function renderMessages(snap){
  const list=$('#rhMsgs'); list.innerHTML=''
  snap.forEach(d=>{
    const m=d.data(); const row=el('div','rh-msg'+(m.uid===me.uid?' me':''))
    const bubble=el('div','rh-bubble'); bubble.textContent=m.text||''
    const meta=el('div','rh-meta'); const t=m.createdAt?.toDate?fmtTime.format(m.createdAt.toDate()):''
    meta.textContent=t
    row.appendChild(bubble); row.appendChild(meta); list.appendChild(row)
  })
  list.scrollTop=list.scrollHeight
}

function setDmBadge(uid, count){
  const badge = document.querySelector(`#rhSidebar .rh-user[data-uid="${uid}"] .dm-badge, #rhSidebar .rh-user[data-uid="${uid}"] .badge`)
  const item = badge?.closest('.rh-user')
  if(!badge || !item) return
  if(count > 0){
    badge.style.display='inline-flex'
    badge.textContent = count > 99 ? '99+' : String(count)
    item.classList.add('has-unread')
  }else{
    badge.style.display='none'
    badge.textContent='0'
    item.classList.remove('has-unread')
  }
}
function setTotalBadge(n){
  state.unreadTotal = n
  const b = document.getElementById('rhChatBadge')
  if(!b) return
  if(n>0){ b.style.display='inline-block'; b.textContent = n>99 ? '99+' : String(n) }
  else { b.style.display='none' }
}

function resortUsersWithUnread(){
  state.users.sort((a,b)=>{
    const ua=(a.unread||0), ub=(b.unread||0)
    if(ub!==ua) return ub-ua
    const ta=(a.lastActiveTs||0), tb=(b.lastActiveTs||0)
    if(tb!==ta) return tb-ta
    return (a.name||'').localeCompare(b.name||'','zh-Hant')
  })
}

function renderPeopleList(){
  const box=$('#rhSidebar'); if(!box) return
  resortUsersWithUnread()
  box.innerHTML=''
  state.users.filter(u=>u.uid!==me?.uid).forEach(u=>{
    const item=el('div','rh-user'+(state.dmTarget?.uid===u.uid?' active':''))
    item.dataset.uid=u.uid
    item.innerHTML=`<span class="dot"></span><span class="name">${u.name||'同事'}</span><span class="dm-badge" style="display:${u.unread>0?'inline-flex':'none'}">${u.unread>99?'99+':(u.unread||0)}</span>`
    item.onclick=()=>setDmTarget(u.uid, u.name)
    box.appendChild(item)
  })
}

function roomDoc(id){ return doc(collection(db,'rooms'), id) }
function messagesCol(id){ return collection(roomDoc(id), 'messages') }
function dmRoomId(a,b){ const [x,y]=[a,b].sort(); return `dm_${x}_${y}` }

function subscribeRoom(id){
  state.roomId=id
  if(unsubRoom){ unsubRoom(); unsubRoom=null }
  const q=query(messagesCol(id), orderBy('createdAt','asc'), limit(200))
  unsubRoom=onSnapshot(q, s=>{ renderMessages(s); markRoomRead(id) })
}

async function unreadForRoom(rid){
  const rd = await getDoc(doc(collection(roomDoc(rid),'read'), me.uid))
  const lastRead = rd.exists()? rd.data().lastReadAt : null
  const lr = lastRead?.toMillis?.() || 0
  const msgsSnap = await getDocs(query(messagesCol(rid), orderBy('createdAt','desc'), limit(50)))
  let c=0, latest=0
  msgsSnap.forEach(m=>{
    const d=m.data()
    if(d.uid===me.uid) return
    const ms = d.createdAt?.toMillis?.() || 0
    if(ms > lr){ c++; if(ms>latest) latest=ms }
  })
  return { count:c, latest }
}

async function loadRecipients(){
  const snap = await getDocs(collection(db,'users'))
  const ok = new Set(['full-time','part-time'])
  const list = []
  snap.forEach(d=>{
    const v=d.data()||{}
    const emp=(v.employment||'').toString().toLowerCase()
    if(!ok.has(emp)) return
    const name = v.nickname || v.name || (v.email ? v.email.split('@')[0] : d.id)
    list.push({ uid:d.id, name, email:v.email||'', lastActiveTs:null, unread:0 })
  })
  if(me && !list.find(u=>u.uid===me.uid)){
    list.push({ uid: me.uid, name: myNick(), email: me.email||'', lastActiveTs: null, unread:0 })
  }
  for(const u of list){
    if(u.uid===me?.uid) continue
    const rid = dmRoomId(me.uid, u.uid)
    const r = await getDoc(roomDoc(rid))
    const ts = r.exists() && r.data().updatedAt ? r.data().updatedAt.toMillis() : null
    u.lastActiveTs = ts
  }
  state.users = list
  renderPeopleList()
}

function watchUnread(){
  if(stopRoomsSnapshot){ stopRoomsSnapshot(); stopRoomsSnapshot=null }
  const roomsQ = query(collection(db,'rooms'), where('participants','array-contains', me.uid))
  stopRoomsSnapshot = onSnapshot(roomsQ, async (snap)=>{
    const updatedMap = new Map()
    const tasks = []
    snap.forEach(r=>{
      const data=r.data()||{}
      if(!Array.isArray(data.participants)) return
      const other = data.participants.find(x=>x!==me?.uid)
      if(!other) return
      updatedMap.set(other, data.updatedAt?.toMillis?.() || 0)
      const rid=r.id
      tasks.push(unreadForRoom(rid).then(({count})=>{
        const u=state.users.find(x=>x.uid===other); if(u) u.unread=count
      }))
    })
    await Promise.all(tasks)
    state.users.forEach(u=>{ if(updatedMap.has(u.uid)) u.lastActiveTs = updatedMap.get(u.uid) })
    renderPeopleList()
    const total = state.users.reduce((s,u)=> s + (u.unread||0), 0)
    setTotalBadge(total)
  })
}

function setDmTarget(uid, name){
  state.dmTarget={ uid, name }
  subscribeRoom(dmRoomId(me.uid, uid))
  document.querySelectorAll('.rh-user').forEach(el=>{
    el.classList.toggle('active', el.dataset.uid===uid)
  })
  setDmBadge(uid, 0)
}

async function send(rid, text){
  if(!me||!text||!text.trim()) return
  const parts = rid.replace(/^dm_/,'').split('_')
  const patch = { type:'dm', participants: parts, updatedAt: serverTimestamp() }
  await setDoc(roomDoc(rid), patch, { merge:true })
  await addDoc(messagesCol(rid),{ uid:me.uid, text:text.trim(), nickname: myNick(), createdAt: serverTimestamp() })
}

async function sendCurrent(){
  const t=$('#rhText')?.value||''; if(!t.trim()||!state.dmTarget) return
  await send(dmRoomId(me.uid, state.dmTarget.uid), t); $('#rhText').value=''
}

async function markRoomRead(rid){
  if(!me||!rid) return
  await setDoc(doc(collection(roomDoc(rid),'read'), me.uid), { lastReadAt: serverTimestamp() }, { merge:true })
}

// keep old cleanup if needed
async function cleanupOldMessages(){ /* omitted for brevity in this build */ }

async function init(){
  ensureDOM()
  onAuthStateChanged(auth, async (user)=>{
    if(!user) return
    me=user
    document.getElementById('rhMeName').textContent = myNick()
    await loadRecipients()
    renderPeopleList()
    watchUnread()
  })
}
function open(){ toggle(true) }
function close(){ toggle(false) }
async function openDM(uid, preset=''){
  if(!me){ toggle(true); return }
  const target = state.users.find(u=>u.uid===uid)
  setDmTarget(uid, target ? target.name : '同事')
  toggle(true)
  if(preset){ const input=$('#rhText'); input.value=preset; input.focus() }
}
async function sendTo(uid, text){
  if(!me) return
  await send(dmRoomId(me.uid, uid), text)
}
function bindBadge(){}

window.RabbitChat={ init, open, close, openDM, sendTo, bindBadge }
export { init, open, close, openDM, sendTo, bindBadge }
