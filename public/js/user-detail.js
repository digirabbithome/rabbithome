import { db, auth } from '/js/firebase.js'
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const allowedAdmins = ['swimming8250@yahoo.com.tw','duckskin@yahoo.com.tw']
const pad2 = n => String(n).padStart(2,'0')
const floorToHalf = h => Math.floor(h*2)/2
const ceilToHalf  = h => Math.ceil(h*2)/2
const isWeekend = dt => { const wd=dt.getDay(); return wd===0||wd===6 }
function sumWorkedHours(punchList){ const mins=punchList.reduce((a,p)=>a+Math.max(0,(new Date(p.out)-new Date(p.in))/60000||0),0); return mins/60 }
function settleFullTimeDay({ requiredHours, punches, leaveHours=0 }){
  let req = Math.max(0,(requiredHours||0)-(leaveHours||0))
  const worked = sumWorkedHours(punches)
  const diff = worked - req
  const overtime = diff>0 ? floorToHalf(diff) : 0
  const shortage = diff<0 ? ceilToHalf(Math.abs(diff)) : 0
  return { req, worked, overtime, shortage, net: overtime - shortage }
}
function settlePartTimeDay({ punches }){
  const worked = sumWorkedHours(punches)
  const payable = floorToHalf(worked)
  return { req:0, worked, payable, overtime:0, shortage:0, net:0 }
}

let uid, yyyymm
window.onload = () => {
  const params = new URLSearchParams(location.search)
  uid = params.get('uid')
  const now = new Date()
  yyyymm = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`
  onAuthStateChanged(auth, async me => {
    const myEmail = me?.email || ''
    if (!me) return location.replace('/user-manage-v2.html')
    if (!allowedAdmins.includes(myEmail) && me.uid !== uid) return location.replace('/user-manage-v2.html')
    await loadAndRender()
    bindMonthNav()
  })
}

async function loadAndRender(){
  document.getElementById('yyyymm').textContent = yyyymm
  const profileSnap = await getDoc(doc(db,'users',uid))
  const profile = profileSnap.exists()? profileSnap.data(): {}
  document.getElementById('title').textContent = `${profile.nickname||profile.name||'(未命名)'} 的月結`
  const [y,m] = yyyymm.split('-').map(Number)
  const dN = new Date(y, m, 0).getDate()
  const isFT = (profile.employment || 'full-time') === 'full-time'

  const punchesCol = collection(db,'punches', uid, `${y}${pad2(m)}`)
  const punchesSnap = await getDocs(punchesCol)
  const punchesByDate = {}
  punchesSnap.forEach(d=>{
    const p=d.data(); const date=(p.in||p.out||'').slice(0,10)
    if (!punchesByDate[date]) punchesByDate[date]=[]
    punchesByDate[date].push(p)
  })

  const leavesSnap = await getDocs(collection(db,'users',uid,'leaves'))
  const leaveBlocksByDate = {}; const hist=[]
  leavesSnap.forEach(d=>{
    const l=d.data(); hist.push(`[${l.status}] ${l.type} ${l.start}~${l.end} ${l.days||''}天`)
    if (l.status!=='approved') return
    let cur=new Date(l.start+'T00:00:00'), end=new Date(l.end+'T00:00:00')
    while (cur<=end){
      const ds = cur.toISOString().slice(0,10)
      if (!leaveBlocksByDate[ds]) leaveBlocksByDate[ds]=[]
      const weekend=isWeekend(cur); const base= weekend?7:9; const hours = l.halfDay ? (base/2) : base
      leaveBlocksByDate[ds].push({ type:l.type, hours })
      cur.setDate(cur.getDate()+1)
    }
  })

  const thead = document.querySelector('.thead')
  thead.innerHTML = isFT
    ? '<span>日期</span><span>班表/應工時</span><span>打卡工時</span><span>差異(±)</span><span>假別</span><span>備註</span>'
    : '<span>日期</span><span>—</span><span>打卡工時</span><span>可支薪(0.5)</span><span>—</span><span>備註</span>'

  let sumReq=0,sumWorked=0,sumOT=0,sumShort=0,annualDays=0,personalDays=0,sumPayablePT=0
  const tbody=document.getElementById('tbody'); tbody.innerHTML=''
  for(let d=1; d<=dN; d++){
    const date = `${y}-${pad2(m)}-${pad2(d)}`
    const dayObj = new Date(`${date}T00:00:00`)
    const weekend = isWeekend(dayObj)
    const punches = punchesByDate[date] || []
    const leaveBlocks = leaveBlocksByDate[date] || []

    if (isFT){
      const requiredHours = weekend?7:9
      const leaveHours = leaveBlocks.reduce((s,b)=>s+(b.hours||0),0)
      const r = settleFullTimeDay({ requiredHours, punches, leaveHours })
      sumReq+=r.req; sumWorked+=r.worked; sumOT+=r.overtime; sumShort+=r.shortage
      annualDays += leaveBlocks.filter(b=>b.type==='annual').length
      personalDays += leaveBlocks.filter(b=>b.type==='personal').length
      const leaveTags = leaveBlocks.map(b => b.type==='annual'?'年假': b.type==='personal'?'事假': b.type).join('、')
      const diffBadge = r.net>0? `<span class="badge plus">+${r.net.toFixed(1)}</span>` :
                        r.net<0? `<span class="badge minus">-${Math.abs(r.net).toFixed(1)}</span>` : '—'
      tbody.insertAdjacentHTML('beforeend', `
        <div class="tr">
          <span>${date}</span>
          <span>${weekend?'週末':'平日'}／${requiredHours}h</span>
          <span>${r.worked.toFixed(2)}h</span>
          <span>${diffBadge}</span>
          <span>${leaveTags||'—'}</span>
          <span></span>
        </div>`)
    } else {
      const r = settlePartTimeDay({ punches })
      sumWorked += r.worked; sumPayablePT += r.payable
      tbody.insertAdjacentHTML('beforeend', `
        <div class="tr">
          <span>${date}</span>
          <span>—</span>
          <span>${r.worked.toFixed(2)}h</span>
          <span>${r.payable.toFixed(1)}h</span>
          <span>—</span>
          <span>兼職按 0.5h 計薪</span>
        </div>`)
    }
  }

  if (isFT){
    document.getElementById('reqH').textContent=`${sumReq.toFixed(1)} h`
    document.getElementById('workedH').textContent=`${sumWorked.toFixed(1)} h`
    document.getElementById('otH').textContent=`+${sumOT.toFixed(1)} h`
    document.getElementById('shortH').textContent=`-${sumShort.toFixed(1)} h`
    document.getElementById('annualDays').textContent=`${annualDays} 天`
    document.getElementById('personalDays').textContent=`${personalDays} 天`
    const net=sumOT-sumShort; document.getElementById('netH').textContent=`${net>=0?'+':''}${net.toFixed(1)} h`
  } else {
    document.querySelector('#summaryCard .row').innerHTML = `
      <div><label>本月打卡總工時</label><b id="workedH">${sumWorked.toFixed(1)} h</b></div>
      <div><label>可支薪工時(0.5)</label><b id="payableH">${sumPayablePT.toFixed(1)} h</b></div>
      <div class="span2 total"><label>備註</label><b id="netH">兼職不計 ±，以時數計薪</b></div>`
  }

  const hDom=document.getElementById('historyList')
  const items= hist.length? hist.slice(-30).reverse() : ['尚無紀錄']
  hDom.innerHTML = items.map(x=>`<div class="item">${x}</div>`).join('')
}
function bindMonthNav(){
  document.getElementById('prevM').onclick=()=>{
    const [y,m]=document.getElementById('yyyymm').textContent.split('-').map(Number)
    const d=new Date(y,m-2,1); yyyymm=`${d.getFullYear()}-${pad2(d.getMonth()+1)}`; loadAndRender()
  }
  document.getElementById('nextM').onclick=()=>{
    const [y,m]=document.getElementById('yyyymm').textContent.split('-').map(Number)
    const d=new Date(y,m,1); yyyymm=`${d.getFullYear()}-${pad2(d.getMonth()+1)}`; loadAndRender()
  }
}
