import { db, auth } from '/js/firebase.js'
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const allowedAdmins=['swimming8250@yahoo.com.tw','duckskin@yahoo.com.tw']
const pad2=n=>String(n).padStart(2,'0')
let uid, yyyymm

window.onload=()=>{
  const params=new URLSearchParams(location.search)
  uid=params.get('uid') || null
  const now=new Date(); yyyymm=`${now.getFullYear()}-${pad2(now.getMonth()+1)}`
  onAuthStateChanged(auth, async me=>{
    if(!me) return alert('請先登入')
    if(!uid) uid = me.uid
    const myEmail = me.email || ''
    if(me.uid!==uid && !allowedAdmins.includes(myEmail)){
      alert('你沒有權限查看他人班表'); uid=me.uid
    }
    await render()
    bindMonthNav()
  })
}

function firstWeekday(y,m){ return new Date(y, m-1, 1).getDay() }
function daysInMonth(y,m){ return new Date(y, m, 0).getDate() }

async function render(){
  document.getElementById('yyyymm').textContent=yyyymm
  const [y,m]=yyyymm.split('-').map(Number)
  const grid=document.getElementById('grid'); grid.innerHTML=''
  const startPad=firstWeekday(y,m); const total=daysInMonth(y,m)

  // load schedules/{uid}/{yyyymm}/days/*
  const daysSnap=await getDocs(collection(db,'schedules', uid, `${y}${pad2(m)}`, 'days'))
  const byDay={}; daysSnap.forEach(d=>byDay[d.id.padStart(2,'0')]=d.data())

  // headers
  const wk=['日','一','二','三','四','五','六']
  for(let i=0;i<7;i++){ const h=document.createElement('div'); h.className='muted'; h.textContent=wk[i]; grid.appendChild(h) }

  // blank padding
  for(let i=0;i<startPad;i++){ grid.appendChild(document.createElement('div')) }

  for(let d=1; d<=total; d++){
    const dd=pad2(d); const cell=document.createElement('div'); cell.className='cell'
    const meta=byDay[dd]||{}
    cell.innerHTML = `<div class="d">${d}</div>`
      + (meta.leaveType ? `<div class="tag ${meta.leaveType==='annual'?'':'red'}">${meta.leaveType==='annual'?'年假':''}${meta.leaveIndex?`(${meta.leaveIndex})`:''}</div>` : '')
      + (meta.offType==='personalOff' ? `<div class="tag">OFF</div>` : '')
      + `<div class="muted">${meta.requiredHoursOverride===0?'不需出勤':''}</div>`
    grid.appendChild(cell)
  }
}

function bindMonthNav(){
  document.getElementById('prevM').onclick=()=>{ const [y,m]=yyyymm.split('-').map(Number); const d=new Date(y,m-2,1); yyyymm=`${d.getFullYear()}-${pad2(d.getMonth()+1)}`; render() }
  document.getElementById('nextM').onclick=()=>{ const [y,m]=yyyymm.split('-').map(Number); const d=new Date(y,m,1);   yyyymm=`${d.getFullYear()}-${pad2(d.getMonth()+1)}`; render() }
}
