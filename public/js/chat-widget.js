// Rabbithome Floating Chat Widget v1.3 (users-collection)
// Source recipients from `users` collection where employment in {'full-time','part-time'}
// Exclude 'resigned'. DM mode shows a dropdown to pick recipient.
// Global chat unchanged. Requires /js/firebase.js exporting { db, auth } (v11.10.0).

import { db, auth } from '/js/firebase.js'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot,
  serverTimestamp, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const TPE='Asia/Taipei'
const fmtTime=new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' })

let me=null, unsubRoom=null
const state={ roomId:'global', users:[], dmTarget:null }

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
      <div class="rh-chat-sidebar" id="rhSidebar">
        <!-- Global 模式保留（未使用人員清單 UI） -->
      </div>
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

async function markRoomRead(rid){
  if(!me||!rid) return
  const rd=doc(collection(roomDoc(rid),'read'), me.uid)
  await setDoc(rd,{ lastReadAt:serverTimestamp() },{ merge:true })
}

// Load recipients from `users` where employment in {'full-time','part-time'}
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
  // Ensure myself included in internal state (not selectable)
  if(me && !list.find(u=>u.uid===me.uid)){
    list.push({ uid: me.uid, nickname: myNick(), email: me.email||'' })
  }
  // Sort by nickname/email
  list.sort((a,b)=> nickOf(a).localeCompare(nickOf(b), 'zh-Hant'))
  state.users = list

  // Build <select> (exclude self)
  const sel = $('#rhToSelect'); if(!sel) return
  sel.innerHTML = `<option value="">選擇收件人…</option>` + list
    .filter(u=>u.uid!==me?.uid)
    .map(u=>`<option value="${u.uid}">${nickOf(u)}</option>`)
    .join('')
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

// Send
async function send(rid, text){
  if(!me||!text||!text.trim()) return
  const nickname = myNick()
  await addDoc(messagesCol(rid),{ uid:me.uid, text:text.trim(), nickname, createdAt:serverTimestamp() })
  await setDoc(roomDoc(rid),{ updatedAt:serverTimestamp() },{ merge:true })
}

async function sendCurrent(){
  const t=$('#rhText')?.value||''; if(!t.trim()) return
  await send(state.roomId||'global', t); $('#rhText').value=''
}

// Badge (simple)
async function computeBadge(){
  if(!me) return
  let total=0
  const readDoc=await getDoc(doc(collection(roomDoc('global'),'read'), me.uid))
  const lr=readDoc.exists()?readDoc.data().lastReadAt:null
  const msgs=await getDocs(query(messagesCol('global'), orderBy('createdAt','desc'), limit(20)))
  msgs.forEach(m=>{ const d=m.data(); if(d.createdAt && (!lr || d.createdAt.toMillis()>lr.toMillis())) total++ })
  const badge=$('#rhChatBadge')
  if(badge){ if(total>0){ badge.style.display='inline-block'; badge.textContent=String(total) } else { badge.style.display='none' } }
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
    await computeBadge()
    setInterval(computeBadge, 30000)
  })
}
function open(){ toggle(true) }
function close(){ toggle(false) }
async function openDM(uid, preset=''){
  if(!me){ toggle(true); return }
  // Select in dropdown if present
  const sel=$('#rhToSelect'); if(sel){ sel.value=uid }
  const target = state.users.find(u=>u.uid===uid)
  setDmTarget(uid, target ? nickOf(target) : '同事')
  // switch to DM tab
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

window.RabbitChat={ init, open, close, openDM, sendTo }
export { init, open, close, openDM, sendTo }