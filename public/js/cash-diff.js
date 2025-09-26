// cash-diff.js — v1.0.3 (nickname from users, month sum uses absolute values)
import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, query, where, orderBy, getDocs,
  doc, updateDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const tz = 'Asia/Taipei'
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const todayStr = () => fmtDate.format(new Date())

let me = null
let profileName = ''
let currentDate = todayStr()
let currentMonth = currentDate.slice(0,7)
const $ = s => document.querySelector(s)

function isAdmin(user){
  if (!user) return false
  const adminEmails = ['swimming8250@yahoo.com.tw','duckskin71@yahoo.com.tw']
  return adminEmails.includes(user.email)
}
let amIAdmin = false

window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return }
    me = user
    try{
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (userSnap.exists() && userSnap.data().nickname){
        profileName = userSnap.data().nickname
      } else {
        profileName = user.displayName || (user.email ? user.email.split('@')[0] : '未命名')
      }
    } catch(e){
      console.warn('讀 nickname 失敗', e)
      profileName = user.displayName || (user.email ? user.email.split('@')[0] : '未命名')
    }
    amIAdmin = isAdmin(user)
    $('#nickname').textContent = profileName + (amIAdmin ? '（管理員）' : '')

    bindUI(); initDates(); await refreshDayList(); await refreshMonth()
  })
}

function bindUI(){
  $('#datePicker').addEventListener('change', async e => {
    currentDate = e.target.value || todayStr()
    $('#listDate').textContent = currentDate
    const ym = currentDate.slice(0,7)
    if (ym !== currentMonth){ currentMonth = ym; $('#monthLabel').textContent = currentMonth; await refreshMonth() }
    await refreshDayList()
  })
  $('#todayBtn').addEventListener('click', async () => {
    $('#datePicker').value = todayStr(); const ev = new Event('change'); $('#datePicker').dispatchEvent(ev)
  })
  $('#prevMonth').addEventListener('click', async () => { shiftMonth(-1) })
  $('#nextMonth').addEventListener('click', async () => { shiftMonth(1) })
  $('#diffForm').addEventListener('submit', onAdd)
  $('#searchInput').addEventListener('input', applyDayFilter)
}

function initDates(){
  $('#datePicker').value = currentDate
  $('#listDate').textContent = currentDate
  $('#monthLabel').textContent = currentMonth
}

function shiftMonth(delta){
  const [y, m] = currentMonth.split('-').map(n=>parseInt(n,10))
  const d = new Date(Date.UTC(y, m-1+delta, 1))
  const ny = d.getUTCFullYear(); const nm = String(d.getUTCMonth()+1).padStart(2,'0')
  currentMonth = `${ny}-${nm}`
  $('#monthLabel').textContent = currentMonth
  currentDate = `${currentMonth}-01`
  $('#datePicker').value = currentDate
  $('#listDate').textContent = currentDate
  refreshMonth(); refreshDayList()
}

async function onAdd(e){
  e.preventDefault()
  const amountVal = Number($('#amount').value)
  const note = $('#note').value.trim()
  if (Number.isNaN(amountVal)){ alert('請輸入金額'); return }
  const payload = {
    date: currentDate, amount: Math.trunc(amountVal), note: note || '',
    filledByUid: me.uid, filledByName: profileName, createdAt: serverTimestamp(),
    zeroed: false, zeroedAt: null, zeroedByUid: null, zeroedByName: null, zeroReason: null,
  }
  await addDoc(collection(db,'cashbox-diffs'), payload)
  $('#amount').value = ''; $('#note').value = ''
  await refreshDayList(); await refreshMonth()
}

let dayRows = []
async function refreshDayList(){
  const q = query(collection(db,'cashbox-diffs'), where('date','==', currentDate), orderBy('createdAt','desc'))
  const snap = await getDocs(q)
  dayRows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  renderDayTable(dayRows)
}

function renderDayTable(rows){
  const tbody = $('#diffTbody'); tbody.innerHTML=''
  for (const r of rows){
    const tr = document.createElement('tr'); if (r.zeroed) tr.classList.add('zeroed')
    const tTime=document.createElement('td'); tTime.textContent=(r.createdAt?.toDate?.()?fmtTime.format(r.createdAt.toDate()):'—')
    const tAmt=document.createElement('td'); tAmt.className='right'; const cls=(r.amount||0)>=0?'amount-pos':'amount-neg'; tAmt.innerHTML=`<span class="${cls}">${r.amount||0}</span>`
    const tWho=document.createElement('td'); tWho.textContent=r.filledByName||'—'
    const tNote=document.createElement('td'); tNote.textContent=r.note||''
    const tAct=document.createElement('td')
    if (!r.zeroed){
      if (amIAdmin){
        const btn=document.createElement('button'); btn.className='btn small'; btn.textContent='✔️ 歸零'
        btn.onclick=async()=>{
          const reason=prompt('歸零原因（可填誰結錯／在哪找到錢）\n\n例如：已在收銀機側邊找到 200 元，A 同事結帳找零遺漏。')
          if (reason===null){ return }
          await updateDoc(doc(db,'cashbox-diffs', r.id), { zeroed:true, zeroedAt: serverTimestamp(), zeroedByUid: me.uid, zeroedByName: profileName, zeroReason: reason||'' })
          await refreshDayList(); await refreshMonth()
        }
        tAct.appendChild(btn)
      }else{
        const badge=document.createElement('span'); badge.className='badge active'; badge.textContent='有效'; tAct.appendChild(badge)
      }
    }else{
      const badge=document.createElement('span'); badge.className='badge zero'; badge.textContent='已歸零'; tAct.appendChild(badge)
      if (amIAdmin){
        const btnUndo=document.createElement('button'); btnUndo.className='btn small ghost'; btnUndo.textContent='↩️ 取消歸零'
        btnUndo.onclick=async()=>{
          if (!confirm('確定要取消歸零？')) return
          await updateDoc(doc(db,'cashbox-diffs', r.id), { zeroed:false, zeroedAt:null, zeroedByUid:null, zeroedByName:null, zeroReason:null })
          await refreshDayList(); await refreshMonth()
        }
        tAct.appendChild(document.createTextNode(' ')); tAct.appendChild(btnUndo)
      }
    }
    tr.append(tTime,tAmt,tWho,tNote,tAct); tbody.appendChild(tr)
  }
}

function applyDayFilter(){
  const kw=$('#searchInput').value.trim()
  if(!kw){renderDayTable(dayRows);return}
  const low=kw.toLowerCase()
  const filtered=dayRows.filter(r=>((r.note||'').toLowerCase().includes(low)||(r.filledByName||'').toLowerCase().includes(low)))
  renderDayTable(filtered)
}

async function refreshMonth(){
  const start=`${currentMonth}-01`
  const [y,m]=currentMonth.split('-').map(n=>parseInt(n,10))
  const d=new Date(Date.UTC(y,m,1)); const ny=d.getUTCFullYear(); const nm=String(d.getUTCMonth()+1).padStart(2,'0')
  const end=`${ny}-${nm}-01`
  const q=query(collection(db,'cashbox-diffs'), where('date','>=',start), where('date','<',end), orderBy('date','desc'), orderBy('createdAt','desc'))
  const snap=await getDocs(q)
  const rows=snap.docs.map(d=>({id:d.id, ...d.data()}))

  // 月合計使用絕對值（未歸零才計入）
  const total=rows.reduce((sum,r)=> sum + (r.zeroed ? 0 : Math.abs(r.amount||0)), 0)
  $('#monthTotal').textContent = total

  const tbody=$('#monthTbody'); tbody.innerHTML=''
  for (const r of rows){
    const tr=document.createElement('tr'); if (r.zeroed) tr.classList.add('zeroed')
    const tDate=document.createElement('td'); tDate.textContent=r.date||''
    const tTime=document.createElement('td'); tTime.textContent=(r.createdAt?.toDate?.()?fmtTime.format(r.createdAt.toDate()):'—')
    const tAmt=document.createElement('td'); tAmt.className='right'; const cls=(r.amount||0)>=0?'amount-pos':'amount-neg'; tAmt.innerHTML=`<span class="${cls}">${r.amount||0}</span>`
    const tWho=document.createElement('td'); tWho.textContent=r.filledByName||'—'
    const tNote=document.createElement('td'); tNote.textContent=r.note||''
    const tZero=document.createElement('td')
    if (r.zeroed){ const info=[]; info.push('已歸零'); if (r.zeroedByName) info.push(`處理人：${r.zeroedByName}`); if (r.zeroReason) info.push(`說明：${r.zeroReason}`); tZero.textContent=info.join('｜') }
    else { tZero.innerHTML='<span class="badge active">有效</span>' }
    tr.append(tDate,tTime,tAmt,tWho,tNote,tZero); tbody.appendChild(tr)
  }
}
