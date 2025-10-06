// Rabbithome Floating Chat Widget v1.0 (module)
import { db, auth } from '/js/firebase.js'
import { collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot, serverTimestamp, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const TPE='Asia/Taipei'
const fmtTime=new Intl.DateTimeFormat('zh-TW',{timeZone:TPE,hour:'2-digit',minute:'2-digit'})
let me=null, unsubRoom=null
const state={ roomId:'global', users:[], dmTarget:null }

const $=(s,r=document)=>r.querySelector(s)
const el=(t,c)=>{const e=document.createElement(t); if(c) e.className=c; return e}

function nicknameFromProfile(u, profile){
  return (profile&&profile.nickname) || localStorage.getItem('nickname') || u?.displayName || (u?.email?u.email.split('@')[0]:'匿名')
}

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
    <div class="rh-chat-sidebar">
      <div class="rh-people-filter"><input id="rhFilter" placeholder="搜尋同事..." /></div>
      <div id="rhPeople"></div>
    </div>
    <div class="rh-chat-main">
      <div id="rhMsgs" class="rh-msgs"></div>
      <div class="rh-input">
        <input id="rhText" placeholder="輸入訊息..." />
        <button id="rhSend">送出</button>
      </div>
    </div>
  </div>`
  document.body.appendChild(fab); document.body.appendChild(panel)
  fab.addEventListener('click',()=>toggle(true)); $('#rhClose',panel).addEventListener('click',()=>toggle(false))
  panel.querySelectorAll('.rh-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      panel.querySelectorAll('.rh-tab').forEach(t=>t.classList.remove('active'))
      tab.classList.add('active')
      const mode=tab.dataset.tab
      if(mode==='global'){ state.dmTarget=null; subscribeRoom('global'); renderPeopleList(false) }
      else { renderPeopleList(true); if(state.dmTarget){ subscribeRoom(dmRoomId(me.uid,state.dmTarget.uid)) } }
    })
  })
  $('#rhSend',panel).addEventListener('click',sendCurrent)
  $('#rhText',panel).addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();sendCurrent()} })
  $('#rhFilter',panel).addEventListener('input',()=>renderPeopleList($('.rh-tab.active').dataset.tab==='dm'))
}

function toggle(open){
  const p=$('.rh-chat-panel'); if(!p) return
  p.style.display=open?'block':'none'
  if(open) markRoomRead(state.roomId)
}

function renderPeopleList(dmOnly){
  const c=$('#rhPeople'); if(!c) return; c.innerHTML=''
  const filter=($('#rhFilter')?.value||'').toLowerCase()
  let users=state.users; if(filter) users=users.filter(u=>(u.name||'').toLowerCase().includes(filter))
  users.forEach(u=>{
    if(dmOnly && u.uid===me?.uid) return
    const item=el('div','rh-user'); item.dataset.uid=u.uid; if(u.online) item.classList.add('online')
    item.innerHTML='<span class="dot"></span><span class="name">'+(u.name||'匿名')+'</span>'
    item.addEventListener('click',()=>setDmTarget(u.uid,u.name))
    if(state.dmTarget?.uid===u.uid) item.classList.add('active')
    c.appendChild(item)
  })
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

function roomDoc(id){ return doc(collection(db,'rooms'),id) }
function messagesCol(id){ return collection(roomDoc(id),'messages') }
function dmRoomId(a,b){ const [x,y]=[a,b].sort(); return `dm_${x}_${y}` }

function subscribeRoom(id){
  state.roomId=id
  if(unsubRoom){ unsubRoom(); unsubRoom=null }
  const q=query(messagesCol(id), orderBy('createdAt','asc'), limit(200))
  unsubRoom=onSnapshot(q, s=>{ renderMessages(s); markRoomRead(id) })
}

async function ensureGlobalRoom(){
  const r=roomDoc('global'); const got=await getDoc(r)
  if(!got.exists()) await setDoc(r,{type:'global',createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
}

async function markRoomRead(rid){
  if(!me) return
  const rd=doc(collection(roomDoc(rid),'read'), me.uid)
  await setDoc(rd,{lastReadAt:serverTimestamp()},{merge:true})
}

async function computeBadge(){
  if(!me) return
  let total=0
  // quick heuristic: unread = last 20 in global
  const readDoc=await getDoc(doc(collection(roomDoc('global'),'read'), me.uid))
  const lr=readDoc.exists()?readDoc.data().lastReadAt:null
  const msgs=await getDocs(query(messagesCol('global'), orderBy('createdAt','desc'), limit(20)))
  msgs.forEach(m=>{ const d=m.data(); if(d.createdAt && (!lr || d.createdAt.toMillis()>lr.toMillis())) total++ })
  const badge=document.getElementById('rhChatBadge')
  if(badge){ if(total>0){ badge.style.display='inline-block'; badge.textContent=String(total) } else { badge.style.display='none' } }
}

async function send(rid, text){
  if(!me||!text||!text.trim()) return
  const prof=await getDoc(doc(collection(db,'profiles'), me.uid))
  const nickname=nicknameFromProfile(me, prof.exists()?prof.data():null)
  await addDoc(messagesCol(rid),{ uid:me.uid, text:text.trim(), nickname, createdAt:serverTimestamp() })
  await setDoc(roomDoc(rid),{ updatedAt:serverTimestamp() },{ merge:true })
}

async function sendCurrent(){
  const input=$('#rhText'); const t=input.value; if(!t.trim()) return
  await send(state.roomId||'global', t); input.value=''
}

async function listUsers(){
  const snap=await getDocs(collection(db,'profiles')); const users=[]
  snap.forEach(d=>{ const v=d.data(); users.push({uid:d.id, name:v?.nickname||v?.name||v?.email||d.id, online:!!v?.online}) })
  if(me && !users.find(u=>u.uid===me.uid)){ users.push({uid:me.uid, name:me.displayName|| (me.email?me.email.split('@')[0]:'我'), online:true}) }
  users.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')); state.users=users; renderPeopleList(false)
}

function setDmTarget(uid,name){
  state.dmTarget={uid,name}; subscribeRoom(dmRoomId(me.uid,uid))
  document.querySelectorAll('.rh-user').forEach(el=>el.classList.toggle('active', el.dataset.uid===uid))
}

// Public API
async function init(){
  ensureDOM()
  onAuthStateChanged(auth, async (user)=>{
    if(!user) return
    me=user; $('#rhMeName').textContent=user.displayName||(user.email?user.email.split('@')[0]:'我')
    await ensureGlobalRoom(); await listUsers(); subscribeRoom('global'); await computeBadge(); setInterval(computeBadge,30000)
  })
}
function open(){ toggle(true) } function close(){ toggle(false) }
async function openDM(uid, preset=''){ if(!me){toggle(true);return} const p=await getDoc(doc(collection(db,'profiles'),uid)); const name=p.exists()?(p.data().nickname||p.data().name||'同事'):'同事'; setDmTarget(uid,name); toggle(true); if(preset){ const input=$('#rhText'); input.value=preset; input.focus() } }
async function sendTo(uid, text){ if(!me) return; await send(dmRoomId(me.uid, uid), text) }

window.RabbitChat={ init, open, close, openDM, sendTo }
export { init, open, close, openDM, sendTo }