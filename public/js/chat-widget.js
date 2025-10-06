// Rabbithome Floating Chat Widget v1.4
// - Unread badge visible on FAB without opening panel
// - DM rooms store participants [uidA, uidB]; live unread via onSnapshot
// - API: RabbitChat.bindBadge('#selector') to mirror unread outside (e.g., sidebar badge)
// - Recipients still sourced from `users` (full-time/part-time), excluding resigned (from v1.3)

import { db, auth } from '/js/firebase.js'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot,
  serverTimestamp, query, where, orderBy, limit, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const TPE='Asia/Taipei'
const fmtTime=new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' })

let me=null, unsubRoom=null, unsubRoomsWatch=null
let externalBadgeSelector=null

const state={ roomId:'global', users:[], dmTarget:null, unreadTotal:0 }

const $=(s,r=document)=>r.querySelector(s)
const el=(t,c)=>{ const e=document.createElement(t); if(c) e.className=c; return e }

function nickOf(u){ return u?.nickname || (u?.email ? u.email.split('@')[0] : '同事') }
function myNick(){ return me?.displayName || (me?.email ? me.email.split('@')[0] : '我') }

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
        <select id="rhToSelect" style="display:none; max-width:190px; padding:4px 6px; border:1px solid #e5e7eb; border-radius:8px; background:#fff;">
          <option value="">選擇收件人…</option>
        </select>
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

  fab.addEventListener('click',()=>toggle(true))
  $('#rhClose',panel).addEventListener('click',()=>toggle(false))

  panel.querySelectorAll('.rh-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      panel.querySelectorAll('.rh-tab').forEach(t=>t.classList.remove('active'))
      tab.classList.add('active')
      const mode=tab.dataset.tab
      if(mode==='global'){
        state.dmTarget=null
        $('#rhToSelect').style.display='none'
        $('#rhSidebar').style.display='block'
        subscribeRoom('global')
      }else{
        $('#rhSidebar').style.display='none'
        $('#rhToSelect').style.display='inline-block'
        ensureDmTargetFromSelect()
      }
    })
  })

  $('#rhSend',panel).addEventListener('click',sendCurrent)
  $('#rhText',panel).addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); sendCurrent() } })
  $('#rhToSelect',panel).addEventListener('change',()=>{
    const sel=$('#rhToSelect'); const uid=sel.value; const name=sel.selectedOptions[0]?.textContent || '同事'
    if(uid) setDmTarget(uid, name)
  })
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

// Recipients from `users` (employment in full-time/part-time)
async function loadRecipients(){
  const snap = await getDocs(collection(db,'users'))
  const ok = new Set(['full-time','part-time'])
  const list = []
  snap.forEach(d=>{
    const v=d.data()||{}
    const emp=(v.employment||'').toString().toLowerCase()
    if(!ok.has(emp)) return
    list.push({ uid:d.id, nickname:v.nickname||'', email:v.email||'' })
  })
  if(me && !list.find(u=>u.uid===me.uid)){
    list.push({ uid: me.uid, nickname: myNick(), email: me.email||'' })
  }
  list.sort((a,b)=> nickOf(a).localeCompare(nickOf(b), 'zh-Hant'))
  state.users = list
  const sel=$('#rhToSelect'); if(sel){
    sel.innerHTML = `<option value="">選擇收件人…</option>` + list
      .filter(u=>u.uid!==me?.uid)
      .map(u=>`<option value="${u.uid}">${nickOf(u)}</option>`)
      .join('')
  }
}

function ensureDmTargetFromSelect(){
  const sel=$('#rhToSelect'); if(!sel) return
  if(!sel.value){
    const first = sel.querySelector('option[value]:not([value=""])')
    if(first) sel.value = first.value
  }
  const uid=sel.value; const name=sel.selectedOptions[0]?.textContent || '同事'
  if(uid) setDmTarget(uid, name)
}

function setDmTarget(uid, name){
  state.dmTarget={ uid, name }
  subscribeRoom(dmRoomId(me.uid, uid))
}

// Send & make sure room has participants for DM
async function send(rid, text){
  if(!me||!text||!text.trim()) return
  const docRef = roomDoc(rid)
  const isDM = rid.startsWith('dm_')
  // Ensure room metadata
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

  await addDoc(messagesCol(rid),{
    uid: me.uid,
    text: text.trim(),
    nickname: myNick(),
    createdAt: serverTimestamp()
  })
}

async function sendCurrent(){
  const t=$('#rhText')?.value||''; if(!t.trim()) return
  await send(state.roomId||'global', t); $('#rhText').value=''
}

// ----- Unread computation (live) -----
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
  // My lastReadAt
  const rd = await getDoc(doc(collection(roomDoc(roomId),'read'), me.uid))
  const lastRead = rd.exists()? rd.data().lastReadAt : null
  // Count messages newer than lastRead and not sent by me
  const msgsSnap = await getDocs(query(messagesCol(roomId), orderBy('createdAt','desc'), limit(50)))
  let c=0
  msgsSnap.forEach(m=>{
    const d=m.data()
    if(d.uid===me.uid) return
    if(!d.createdAt) return
    if(!lastRead || d.createdAt.toMillis() > lastRead.toMillis()) c++
  })
  return c
}

let stopRoomsSnapshot=null, stopGlobalSnapshot=null
function watchUnread(){
  // Stop previous
  if(stopRoomsSnapshot){ stopRoomsSnapshot(); stopRoomsSnapshot=null }
  if(stopGlobalSnapshot){ stopGlobalSnapshot(); stopGlobalSnapshot=null }

  // Global: watch latest message + my read doc to recompute
  stopGlobalSnapshot = onSnapshot(roomDoc('global'), async (_)=>{
    const count = await unreadForRoom('global')
    // We'll combine with DMs below; here we store temp on window
    window.__rh_global_unread = count
    recomputeTotal()
  })
  // Also watch my read doc in global
  onSnapshot(doc(collection(roomDoc('global'),'read'), me.uid), async (_)=>{
    const count = await unreadForRoom('global')
    window.__rh_global_unread = count
    recomputeTotal()
  })

  // Watch DM rooms where participants contains me.uid
  const roomsQ = query(collection(db,'rooms'), where('participants','array-contains', me.uid))
  stopRoomsSnapshot = onSnapshot(roomsQ, async (snap)=>{
    let sum = 0
    const tasks = []
    snap.forEach(r=>{
      if(r.id==='global') return
      tasks.push(unreadForRoom(r.id).then(c=>{ sum += c }))
    })
    await Promise.all(tasks)
    window.__rh_dm_unread = sum
    recomputeTotal()
  })
  // Also recompute on my read doc changes for any dm
  // (We won't attach individual listeners to each dm/read, to keep it simple)
}

function recomputeTotal(){
  const g = Number(window.__rh_global_unread||0)
  const d = Number(window.__rh_dm_unread||0)
  setBadgeCount(g + d)
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
    watchUnread() // live badge
    // Fallback: periodic recompute (in case listeners miss edge cases)
    setInterval(async ()=>{
      await Promise.resolve() // noop; listeners keep it fresh
    }, 30000)
  })
}
function open(){ toggle(true) }
function close(){ toggle(false) }
async function openDM(uid, preset=''){
  if(!me){ toggle(true); return }
  const sel=$('#rhToSelect'); if(sel){ sel.value=uid }
  const target = state.users.find(u=>u.uid===uid)
  setDmTarget(uid, target ? nickOf(target) : '同事')
  document.querySelectorAll('.rh-tab').forEach(t=> t.classList.toggle('active', t.dataset.tab==='dm'))
  $('#rhSidebar').style.display='none'; $('#rhToSelect').style.display='inline-block'
  toggle(true)
  if(preset){ const input=$('#rhText'); input.value=preset; input.focus() }
}
async function sendTo(uid, text){
  if(!me) return
  const rid = dmRoomId(me.uid, uid)
  await send(rid, text)
}
// Mirror unread count into an external badge element (e.g., a span in sidebar)
function bindBadge(selector){ externalBadgeSelector = selector }

window.RabbitChat={ init, open, close, openDM, sendTo, bindBadge }
export { init, open, close, openDM, sendTo, bindBadge }