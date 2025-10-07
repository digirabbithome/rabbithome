// Rabbithome Floating Chat Widget v1.7.2 — DM-only, per-user unread badges, auto-open recent
import { db, auth } from '/js/firebase.js'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot,
  serverTimestamp, query, where, orderBy, limit, Timestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const TPE='Asia/Taipei'
const fmtTime=new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' })

let me=null, unsubRoom=null, stopRoomsSnapshot=null
let externalBadgeSelector=null

// state.users: [{uid, name, email, lastActiveTs:number|null}]
const state={ roomId:null, users:[], dmTarget:null, unreadTotal:0 }
const dmUnreadCount = new Map() // peerUid -> count
const lastMap = {}              // peerUid -> latest message millis

const $=(s,r=document)=>r.querySelector(s)
const el=(t,c)=>{ const e=document.createElement(t); if(c) e.className=c; return e }

const myNick = () => me?.displayName || (me?.email ? me.email.split('@')[0] : '我')

function ensureDOM(){
  if(document.querySelector('.rh-chat-fab')) return
  const fab=el('div','rh-chat-fab'); fab.innerHTML='💬<span class="badge" id="rhChatBadge">0</span>'; fab.title='開啟聊天室'
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

  fab.addEventListener('click',()=>{ toggle(true); openMostRecentDM() })
  $('#rhClose',panel).addEventListener('click',()=>toggle(false))

  // 單一「私訊」頁籤，不需切換
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

// ----- Sidebar people list -----
function resortUsersInState(){
  const withTs = state.users.filter(u=>typeof u.lastActiveTs==='number')
  const noTs = state.users.filter(u=>u.lastActiveTs==null)

  withTs.sort((a,b)=> b.lastActiveTs - a.lastActiveTs) // recent first
  noTs.sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'zh-Hant'))

  state.users = withTs.concat(noTs)
}

function setDmBadge(uid, count){
  const badge = document.getElementById(`rhDmBadge_${uid}`)
  const item = badge?.closest('.rh-user')
  if(!badge || !item) return
  if(count>0){
    badge.textContent = count>99 ? '99+' : String(count)
    badge.style.display='inline-block'
    item.classList.add('has-unread')
  }else{
    badge.textContent='0'
    badge.style.display='none'
    item.classList.remove('has-unread')
  }
}

function renderPeopleList(){
  resortUsersInState()
  const box=$('#rhSidebar'); if(!box) return
  box.innerHTML=''
  const list=el('div'); list.id='rhPeople'
  state.users.filter(u=>u.uid!==me?.uid).forEach(u=>{
    const item=el('div','rh-user'+(state.dmTarget?.uid===u.uid?' active':''))
    item.dataset.uid=u.uid
    item.innerHTML=`<span class="dot"></span><span class="name">${u.name||'同事'}</span><span class="dm-badge" id="rhDmBadge_${u.uid}">0</span>`
    item.onclick=()=>setDmTarget(u.uid, u.name)
    list.appendChild(item)
    // 初始顯示未讀
    setDmBadge(u.uid, dmUnreadCount.get(u.uid)||0)
  })
  box.appendChild(list)
}

function setDmTarget(uid, name){
  state.dmTarget={ uid, name }
  subscribeRoom(dmRoomId(me.uid, uid))
  document.querySelectorAll('.rh-user').forEach(el=>{
    el.classList.toggle('active', el.dataset.uid===uid)
  })
  // 標記已讀並清除 badge
  setDmBadge(uid, 0)
}

// Firestore helpers
function roomDoc(id){ return doc(collection(db,'rooms'), id) }
function messagesCol(id){ return collection(roomDoc(id), 'messages') }
function dmRoomId(a,b){ const [x,y]=[a,b].sort(); return `dm_${x}_${y}` }

function subscribeRoom(id){
  state.roomId=id
  if(unsubRoom){ unsubRoom(); unsubRoom=null }
  const q=query(messagesCol(id), orderBy('createdAt','asc'), limit(200))
  unsubRoom=onSnapshot(q, s=>{ renderMessages(s); markRoomRead(id) })
}

// Recipients from `users` (exclude resigned) + lastActiveTs from room.updatedAt
async function loadRecipients(){
  const snap = await getDocs(collection(db,'users'))
  const list = []
  snap.forEach(d=>{
    const v=d.data()||{}
    const emp=(v.employment||'full-time').toString().toLowerCase()
    if(emp==='resigned') return
    const name = v.nickname || v.name || (v.email ? v.email.split('@')[0] : d.id)
    list.push({ uid:d.id, name, email:v.email||'', lastActiveTs:null })
  })
  if(me && !list.find(u=>u.uid===me.uid)){
    list.push({ uid: me.uid, name: myNick(), email: me.email||'', lastActiveTs: null })
  }

  // attach lastActiveTs from DM room's updatedAt
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

// Send & ensure room metadata
async function send(rid, text){
  if(!me||!text||!text.trim()) return
  const docRef = roomDoc(rid)
  const parts = rid.replace(/^dm_/,'').split('_')
  const patch = { type:'dm', participants: parts, updatedAt: serverTimestamp() }
  await setDoc(docRef, patch, { merge:true })
  await addDoc(messagesCol(rid),{ uid:me.uid, text:text.trim(), nickname: myNick(), createdAt: serverTimestamp() })
}

async function sendCurrent(){
  const t=$('#rhText')?.value||''; if(!t.trim()||!state.roomId) return
  await send(state.roomId, t); $('#rhText').value=''
}

// Read / Unread
async function markRoomRead(rid){
  if(!me||!rid) return
  await setDoc(doc(collection(roomDoc(rid),'read'), me.uid), { lastReadAt: serverTimestamp() }, { merge:true })
}

function setBadgeCount(n){
  state.unreadTotal = n
  const badge = $('#rhChatBadge')
  if(badge){ if(n>0){ badge.style.display='inline-block'; badge.textContent=String(n) } else { badge.style.display='none' } }
  if(externalBadgeSelector){
    const ext = document.querySelector(externalBadgeSelector)
    if(ext){
      ext.style.display = n>0 ? '' : 'none'
      ext.textContent = String(n)
    }
  }
}

// watch unread of all DM rooms, update per-user badge + total
function watchUnread(){
  if(stopRoomsSnapshot){ stopRoomsSnapshot(); stopRoomsSnapshot=null }

  const roomsQ = query(collection(db,'rooms'), where('participants','array-contains', me.uid))
  stopRoomsSnapshot = onSnapshot(roomsQ, async (snap)=>{
    let sum = 0
    const updatedMap = new Map()
    const tasks = []

    snap.forEach(r=>{
      const data=r.data()||{}
      if(!Array.isArray(data.participants)) return
      const other = data.participants.find(x=>x!==me?.uid)
      if(!other) return
      const rid = r.id
      const ts = data.updatedAt ? data.updatedAt.toMillis() : 0
      updatedMap.set(other, ts)

      tasks.push((async ()=>{
        const rd = await getDoc(doc(collection(roomDoc(rid),'read'), me.uid))
        const lastRead = rd.exists()? rd.data().lastReadAt : null
        const msgsSnap = await getDocs(query(messagesCol(rid), orderBy('createdAt','desc'), limit(50)))
        let c=0, latest=0
        msgsSnap.forEach(m=>{
          const d=m.data()
          if(d.uid===me.uid) return
          if(!d.createdAt) return
          const ms = d.createdAt.toMillis()
          const lr = lastRead?.toMillis?.()||0
          if(ms>lr){ c++; if(ms>latest) latest=ms }
        })
        dmUnreadCount.set(other, c)
        lastMap[other] = Math.max(lastMap[other]||0, latest)
        setDmBadge(other, c)
        sum += c
      })())
    })

    await Promise.all(tasks)

    // update users lastActiveTs based on rooms snapshot
    state.users.forEach(u=>{
      if(u.uid===me?.uid) return
      if(updatedMap.has(u.uid)) u.lastActiveTs = updatedMap.get(u.uid)
    })
    renderPeopleList() // live resort

    setBadgeCount(sum)
  })
}

function openMostRecentDM(){
  // pick highest lastMap or by lastActiveTs
  let bestUid=null, bestTs=-1
  state.users.filter(u=>u.uid!==me?.uid).forEach(u=>{
    const ts = lastMap[u.uid] || u.lastActiveTs || 0
    if(ts>bestTs){ bestTs=ts; bestUid=u.uid }
  })
  if(!bestUid && state.users.length>0){
    bestUid = state.users.find(u=>u.uid!==me?.uid)?.uid
  }
  if(bestUid){
    const target = state.users.find(u=>u.uid===bestUid)
    setDmTarget(bestUid, target?.name||'同事')
  }
}

// 30-day retention cleanup
async function cleanupOldMessages(){
  try{
    const key='rh_cleanup_last'; const last=localStorage.getItem(key)
    const today=(new Date()).toISOString().slice(0,10)
    if(last===today) return
    localStorage.setItem(key, today)

    const cutoffMs = Date.now() - 30*24*60*60*1000

    // collect my dm rooms
    const dmSnap = await getDocs(query(collection(db,'rooms'), where('participants','array-contains', me.uid)))
    const roomIds = dmSnap.docs.map(d=>d.id)

    for(const rid of roomIds){
      let loop=0
      while(loop<10){
        const batchSnap = await getDocs(query(messagesCol(rid), orderBy('createdAt','asc'), limit(200)))
        const toDelete = []
        batchSnap.forEach(m=>{
          const d=m.data()
          if(d.createdAt && d.createdAt.toMillis() < cutoffMs) toDelete.push(m.ref)
        })
        if(toDelete.length===0) break
        for(const ref of toDelete){ await deleteDoc(ref) }
        loop++
      }
      await setDoc(roomDoc(rid), { updatedAt: serverTimestamp() }, { merge:true })
    }
  }catch(err){ console.warn('cleanupOldMessages error', err) }
}

// Public API
async function init(){
  ensureDOM()
  onAuthStateChanged(auth, async (user)=>{
    if(!user) return
    me=user
    $('#rhMeName').textContent = myNick()
    await loadRecipients()
    renderPeopleList()
    openMostRecentDM()
    watchUnread()
    setTimeout(cleanupOldMessages, 3000)
  })
}
function open(){ toggle(true); openMostRecentDM() }
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
  const rid = dmRoomId(me.uid, uid)
  await send(rid, text)
}
function bindBadge(selector){ externalBadgeSelector = selector }

window.RabbitChat={ init, open, close, openDM, sendTo, bindBadge }
export { init, open, close, openDM, sendTo, bindBadge }