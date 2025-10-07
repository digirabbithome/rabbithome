// Rabbithome Floating Chat Widget v1.8 — DM only + unread red badge
import { db, auth } from '/js/firebase.js'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot,
  serverTimestamp, query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const TPE='Asia/Taipei'
const fmtTime=new Intl.DateTimeFormat('zh-TW',{ timeZone:TPE, hour:'2-digit', minute:'2-digit' })
let me=null, unsubRoom=null

const state={ users:[], dmTarget:null }

function $(s,r=document){return r.querySelector(s)}
function el(t,c){const e=document.createElement(t);if(c)e.className=c;return e}
const myNick=()=>me?.displayName||(me?.email?me.email.split('@')[0]:'我')

function ensureDOM(){
  if($('.rh-chat-fab'))return
  const fab=el('div','rh-chat-fab');fab.innerHTML='💬';fab.title='開啟聊天室'
  const panel=el('div','rh-chat-panel')
  panel.innerHTML=`
  <div class="rh-chat-header">
    <div class="rh-chat-tabs"><div class="rh-tab active" data-tab="dm">私訊</div></div>
    <div><span id="rhMeName" style="font-size:12px;color:#6b7280"></span>
    <button id="rhClose">✕</button></div>
  </div>
  <div class="rh-chat-body">
    <div class="rh-chat-sidebar" id="rhSidebar"></div>
    <div class="rh-chat-main">
      <div id="rhMsgs" class="rh-msgs"></div>
      <div class="rh-input"><input id="rhText" placeholder="輸入訊息..."/><button id="rhSend">送出</button></div>
    </div>
  </div>`
  document.body.appendChild(fab);document.body.appendChild(panel)
  fab.onclick=()=>toggle(true)
  $('#rhClose').onclick=()=>toggle(false)
  $('#rhSend').onclick=sendCurrent
  $('#rhText').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendCurrent()}})
}

function toggle(open){
  const p=$('.rh-chat-panel');if(!p)return
  p.style.display=open?'block':'none'
}

function renderMessages(snap){
  const list=$('#rhMsgs');list.innerHTML=''
  snap.forEach(d=>{
    const m=d.data();const row=el('div','rh-msg'+(m.uid===me.uid?' me':''))
    const bubble=el('div','rh-bubble');bubble.textContent=m.text||''
    const meta=el('div','rh-meta');const t=m.createdAt?.toDate?fmtTime.format(m.createdAt.toDate()):''
    meta.textContent=t;row.appendChild(bubble);row.appendChild(meta);list.appendChild(row)
  });list.scrollTop=list.scrollHeight
}

function dmRoomId(a,b){const[x,y]=[a,b].sort();return`dm_${x}_${y}`}
function roomDoc(id){return doc(collection(db,'rooms'),id)}
function messagesCol(id){return collection(roomDoc(id),'messages')}

function subscribeRoom(id){
  if(unsubRoom){unsubRoom();unsubRoom=null}
  const q=query(messagesCol(id),orderBy('createdAt','asc'),limit(200))
  unsubRoom=onSnapshot(q,s=>renderMessages(s))
}

async function send(rid,text){
  if(!text.trim())return
  await setDoc(roomDoc(rid),{type:'dm',updatedAt:serverTimestamp()},{merge:true})
  await addDoc(messagesCol(rid),{uid:me.uid,text,nickname:myNick(),createdAt:serverTimestamp()})
}

async function sendCurrent(){
  const t=$('#rhText').value.trim();if(!t)return
  const rid=dmRoomId(me.uid,state.dmTarget.uid)
  await send(rid,t);$('#rhText').value=''
}

async function loadRecipients(){
  const snap=await getDocs(collection(db,'users'))
  const ok=new Set(['full-time','part-time'])
  const list=[]
  snap.forEach(d=>{
    const v=d.data()||{}
    if(!ok.has((v.employment||'').toLowerCase()))return
    const name=v.nickname||v.name||d.id
    list.push({uid:d.id,name,lastActiveTs:null,unread:0})
  })
  state.users=list.filter(u=>u.uid!==me?.uid)
  renderPeopleList()
  watchUnread()
}

function renderPeopleList(){
  const box=$('#rhSidebar');box.innerHTML=''
  state.users.forEach(u=>{
    const item=el('div','rh-user');item.dataset.uid=u.uid
    item.innerHTML=`<span class="dot"></span><span class="name">${u.name}</span><span class="badge" style="display:${u.unread>0?'inline-flex':'none'}">${u.unread>9?'9+':u.unread}</span>`
    item.onclick=()=>setDmTarget(u.uid,u.name)
    box.appendChild(item)
  })
}

function setDmTarget(uid,name){
  state.dmTarget={uid,name}
  subscribeRoom(dmRoomId(me.uid,uid))
  document.querySelectorAll('.rh-user').forEach(e=>e.classList.toggle('active',e.dataset.uid===uid))
  const target=state.users.find(u=>u.uid===uid);if(target){target.unread=0;renderPeopleList()}
}

function watchUnread(){
  const q=query(collection(db,'rooms'),where('participants','array-contains',me.uid))
  onSnapshot(q,snap=>{
    const map=new Map()
    snap.forEach(r=>{
      const data=r.data()
      if(!Array.isArray(data.participants))return
      const other=data.participants.find(x=>x!==me.uid)
      if(!other)return
      map.set(other,(map.get(other)||0)+1)
    })
    state.users.forEach(u=>{u.unread=map.get(u.uid)||0})
    renderPeopleList()
  })
}

function init(){
  ensureDOM()
  onAuthStateChanged(auth,async user=>{
    if(!user)return
    me=user;$('#rhMeName').textContent=myNick()
    await loadRecipients()
  })
}
window.RabbitChat={init}
export{init}
