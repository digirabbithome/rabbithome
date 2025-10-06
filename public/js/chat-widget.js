// Rabbithome Floating Chat Widget v1.7 — People sorted by recent DM activity
import { db, auth } from '/js/firebase.js'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot,
  serverTimestamp, query, where, orderBy, limit, Timestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const TPE='Asia/Taipei'
const fmtTime=new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' })

let me=null, unsubRoom=null, stopRoomsSnapshot=null, stopGlobalSnapshot=null
let externalBadgeSelector=null

// state.users: [{uid, name, email, lastActiveTs:number|null}]
const state={ roomId:'global', users:[], dmTarget:null, unreadTotal:0, latestUnreadRoomId:null }

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
        <div class="rh-tab active" data-tab="global">全體</div>
        <div class="rh-tab" data-tab="dm">私訊</div>
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

  fab.addEventListener('click',()=>{ toggle(true); openLatestUnreadIfAny() })
  $('#rhClose',panel).addEventListener('click',()=>toggle(false))

  // Tabs
  panel.querySelectorAll('.rh-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      panel.querySelectorAll('.rh-tab').forEach(t=>t.classList.remove('active'))
      tab.classList.add('active')
      const mode=tab.dataset.tab
      if(mode==='global'){
        state.dmTarget=null
        $('#rhSidebar').style.display='block'
        subscribeRoom('global')
      }else{
        $('#rhSidebar').style.display='block'
        renderPeopleList()
        if(!state.dmTarget){
          const first = state.users.find(u=>u.uid!==me?.uid)
          if(first) setDmTarget(first.uid, first.name)
        }else{
          subscribeRoom(dmRoomId(me.uid, state.dmTarget.uid))
        }
      }
    })
  })

  $('#rhSend',panel).addEventListener('click',sendCurrent)
  $('#rhText',panel).addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); sendCurrent() } })
}

function toggle(open){
  const p=$('.rh-chat-panel'); if(!p) return
  p.style.display=open?'block':'none'
  if(open) markRoomRead(state.roomId)
}

function renderMessages(snap){
  const list=$('#rhMsgs'); list.innerHTML=''
  snap.forEach(d=>{
    const m=d.data(); const row=el('div','rh-msg'+(m.uid===me.uid?' me':''))
    const bubble=el('div','rh-bubble'); bubble.textContent=m.text||''
    const meta=el('div','rh-meta'); const t=m.createdAt?.toDate?fmtTime.format(m.createdAt.toDate()):''
    meta.textContent=(state.roomId==='global'&&m.nickname?(m.nickname+' · '):'')+t
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

function renderPeopleList(){
  resortUsersInState()
  const box=$('#rhSidebar'); if(!box) return
  box.innerHTML=''
  const list=el('div'); list.id='rhPeople'
  state.users.filter(u=>u.uid!==me?.uid).forEach(u=>{
    const item=el('div','rh-user'+(state.dmTarget?.uid===u.uid?' active':''))
    item.dataset.uid=u.uid
    item.innerHTML=`<span class="dot"></span><span class="name">${u.name||'同事'}</span>`
    item.onclick=()=>setDmTarget(u.uid, u.name)
    list.appendChild(item)
  })
  box.appendChild(list)
}

function setDmTarget(uid, name){
  state.dmTarget={ uid, name }
  subscribeRoom(dmRoomId(me.uid, uid))
  document.querySelectorAll('.rh-user').forEach(el=>{
    el.classList.toggle('active', el.dataset.uid===uid)
  })
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

async function ensureGlobalRoom(){
  const r=roomDoc('global'); const got=await getDoc(r)
  if(!got.exists()) await setDoc(r,{ type:'global', createdAt:serverTimestamp(), updatedAt:serverTimestamp() })
}

// Recipients from `users` (employment in full-time/part-time) + lastActiveTs from room.updatedAt
async function loadRecipients(){
  const snap = await getDocs(collection(db,'users'))
  const ok = new Set(['full-time','part-time'])
  const list = []
  snap.forEach(d=>{
    const v=d.data()||{}
    const emp=(v.employment||'').toString().toLowerCase()
    if(!ok.has(emp)) return
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
  const isDM = rid.startsWith('dm_')
  const patch = { updatedAt: serverTimestamp() }
  if(isDM){
    const parts = rid.replace(/^dm_/,'').split('_')
    if(parts.length===2){
      patch.type = 'dm'
      patch.participants = parts
    }
  }else{
    patch.type = 'global'
  }
  await setDoc(docRef, patch, { merge:true })
  await addDoc(messagesCol(rid),{ uid:me.uid, text:text.trim(), nickname: myNick(), createdAt: serverTimestamp() })
}

async function sendCurrent(){
  const t=$('#rhText')?.value||''; if(!t.trim()) return
  await send(state.roomId||'global', t); $('#rhText').value=''
}

// Read / Unread
async function markRoomRead(rid){
  if(!me||!rid) return
  await setDoc(doc(collection(roomDoc(rid),'read'), me.uid), { lastReadAt: serverTimestamp() }, { merge:true })
}

// Badge
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

async function unreadForRoom(roomId){
  const rd = await getDoc(doc(collection(roomDoc(roomId),'read'), me.uid))
  const lastRead = rd.exists()? rd.data().lastReadAt : null
  const msgsSnap = await getDocs(query(messagesCol(roomId), orderBy('createdAt','desc'), limit(50)))
  let c=0, latestTs=0
  msgsSnap.forEach(m=>{
    const d=m.data()
    if(d.uid===me.uid) return
    if(!d.createdAt) return
    const ms = d.createdAt.toMillis()
    if(!lastRead || ms > lastRead.toMillis()){ c++; if(ms > latestTs) latestTs = ms }
  })
  return { count:c, latest: latestTs }
}

function watchUnread(){
  if(stopRoomsSnapshot){ stopRoomsSnapshot(); stopRoomsSnapshot=null }
  if(stopGlobalSnapshot){ stopGlobalSnapshot(); stopGlobalSnapshot=null }

  const recomputeGlobal = async ()=>{
    const u = await unreadForRoom('global')
    window.__rh_global_unread = u.count
    window.__rh_global_latest = u.latest
    recomputeTotal()
  }
  stopGlobalSnapshot = onSnapshot(roomDoc('global'), recomputeGlobal)
  onSnapshot(doc(collection(roomDoc('global'),'read'), me.uid), recomputeGlobal)

  const roomsQ = query(collection(db,'rooms'), where('participants','array-contains', me.uid))
  stopRoomsSnapshot = onSnapshot(roomsQ, async (snap)=>{
    let sum = 0, latest=0
    const updatedMap = new Map()
    const tasks = []
    snap.forEach(r=>{
      const data=r.data()||{}
      const ts = data.updatedAt ? data.updatedAt.toMillis() : 0
      // collect for sorting
      if(Array.isArray(data.participants)){
        const other = data.participants.find(x=>x!==me?.uid)
        if(other){ updatedMap.set(other, ts) }
      }
      if(r.id!=='global'){
        tasks.push(unreadForRoom(r.id).then(({count,latest:tsm})=>{ sum += count; if(tsm>latest) latest = tsm }))
      }
    })
    await Promise.all(tasks)
    // update users lastActiveTs based on rooms snapshot
    state.users.forEach(u=>{
      if(u.uid===me?.uid) return
      if(updatedMap.has(u.uid)) u.lastActiveTs = updatedMap.get(u.uid)
    })
    renderPeopleList() // live resort
    window.__rh_dm_unread = sum
    window.__rh_dm_latest = latest
    recomputeTotal()
  })
}

function recomputeTotal(){
  const g = Number(window.__rh_global_unread||0)
  const d = Number(window.__rh_dm_unread||0)
  setBadgeCount(g + d)
  const gl = Number(window.__rh_global_latest||0)
  const dl = Number(window.__rh_dm_latest||0)
  if(g + d === 0){ state.latestUnreadRoomId = null; return }
  state.latestUnreadRoomId = (dl>gl) ? 'dm_latest' : 'global'
}

// Auto-open latest unread
async function openLatestUnreadIfAny(){
  if(state.unreadTotal<=0) return
  if(state.latestUnreadRoomId==='global'){
    document.querySelectorAll('.rh-tab').forEach(t=> t.classList.toggle('active', t.dataset.tab==='global'))
    $('#rhSidebar').style.display='block'
    subscribeRoom('global')
    return
  }
  // find dm with latest unread
  let best = { rid:null, ts:0, uid:null, name:null }
  const tasks = state.users.filter(u=>u.uid!==me?.uid).map(async u=>{
    const rid = dmRoomId(me.uid, u.uid)
    const info = await unreadForRoom(rid)
    if(info.count>0 && info.latest>best.ts){ best = { rid, ts:info.latest, uid:u.uid, name: u.name } }
  })
  await Promise.all(tasks)
  if(best.rid){
    document.querySelectorAll('.rh-tab').forEach(t=> t.classList.toggle('active', t.dataset.tab==='dm'))
    $('#rhSidebar').style.display='block'
    setDmTarget(best.uid, best.name)
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

    const roomIds = new Set(['global'])
    const dmSnap = await getDocs(query(collection(db,'rooms'), where('participants','array-contains', me.uid)))
    dmSnap.forEach(r=> roomIds.add(r.id))

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
    await ensureGlobalRoom()
    await loadRecipients()
    subscribeRoom('global')
    watchUnread()
    setTimeout(cleanupOldMessages, 3000)
  })
}
function open(){ toggle(true); openLatestUnreadIfAny() }
function close(){ toggle(false) }
async function openDM(uid, preset=''){
  if(!me){ toggle(true); return }
  const target = state.users.find(u=>u.uid===uid)
  setDmTarget(uid, target ? target.name : '同事')
  document.querySelectorAll('.rh-tab').forEach(t=> t.classList.toggle('active', t.dataset.tab==='dm'))
  $('#rhSidebar').style.display='block'
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
