import { db, auth } from '/js/firebase.js'
import { collectionGroup, getDocs, getDoc, doc, writeBatch, updateDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const ADMINS=['swimming8250@yahoo.com.tw','duckskin@yahoo.com.tw']
const pad2 = n => String(n).padStart(2,'0')
const expandDates=(start,end)=>{const out=[]; const s=new Date(start+'T00:00:00'), e=new Date(end+'T00:00:00'); for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) out.push(d.toISOString().slice(0,10)); return out}
// TPE formatters
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const nowTPE = () => `${fmtDate.format(new Date())} ${fmtTime.format(new Date())}`

window.onload=()=>{
  onAuthStateChanged(auth, async me=>{
    if(!me || !ADMINS.includes(me.email||'')){ alert('需管理者登入'); location.replace('/user-manage-v2.html'); return }
    bindUI(); await refresh()
  })
}
function bindUI(){
  document.getElementById('refresh').onclick=refresh
  const now=new Date(), y=now.getFullYear(), m=pad2(now.getMonth()+1)
  document.getElementById('from').value = `${y}-${m}-01`
  document.getElementById('to').value   = `${y}-${m}-${new Date(y, parseInt(m), 0).getDate()}`
}
function statusCN(s){ return s==='approved'?'已核准': s==='rejected'?'已拒絕':'待審核' }

async function refresh(){
  const list=document.getElementById('list'); list.innerHTML='載入中…'
  const statusSel=document.getElementById('status').value
  const from=document.getElementById('from').value, to=document.getElementById('to').value
  const allSnap = await getDocs(collectionGroup(db,'leaves'))
  list.innerHTML=''
  for(const d of allSnap.docs){
    const l=d.data(); const uid=d.ref.parent.parent.id
    if(statusSel!=='all' && l.status!==statusSel) continue
    const dates=expandDates(l.start,l.end)
    const inRange = (!from&&!to) || dates.some(dd => (!from || dd>=from) && (!to || dd<=to))
    if(!inRange) continue
    const uSnap=await getDoc(doc(db,'users',uid)); const u=uSnap.exists()? uSnap.data(): {}
    const name=u.nickname||u.name||'(未命名)', email=u.email||''
    const days = l.days || dates.length
    const row=document.createElement('div'); row.className='row'; row.innerHTML=`
      <span>${name}</span><span>${email}</span>
      <span>${l.start} ~ ${l.end}</span>
      <span>${days}</span>
      <span>${l.type==='annual'?'年假':l.type}</span>
      <span><span class="badge ${l.status}">${statusCN(l.status)}</span></span>
      <span>—</span>
      <span class="actions">${
        l.status==='pending' ? `<button data-act="approve" data-path="${d.ref.path}">核准</button>
                                <button data-act="reject" class="secondary" data-path="${d.ref.path}">拒絕</button>`
                              : '<small class="muted">已完結</small>'
      }</span>`
    list.appendChild(row)
  }
  list.onclick=async e=>{
    const btn=e.target.closest('button[data-act]'); if(!btn) return
    const act=btn.dataset.act, ref=doc(db, btn.dataset.path); const snap=await getDoc(ref); if(!snap.exists()) return alert('申請不存在')
    const l=snap.data(), uid=ref.parent.parent.id
    if(act==='reject'){ await updateDoc(ref,{status:'rejected', rejectedAtTPE: nowTPE(), approver:auth.currentUser?.uid||null}); return refresh() }
    if(act==='approve'){
      // 檢查年假額度（不足則提示是否超扣）
      const uRef=doc(db,'users',uid); const uSnap=await getDoc(uRef)
      const u=uSnap.exists()? uSnap.data(): {}
      const year=new Date().getFullYear()
      const p=u.annualLeavePolicy||{}, s=u.leaveStats?.year===year? u.leaveStats : {approvedTaken:0}
      const eff=p.effectiveFrom? new Date(p.effectiveFrom+'T00:00:00'): null, now=new Date()
      const quota=(eff && now<eff) ? 0 : (Number(p.baseDays||0)+Number(p.carryOverDays||0)+Number(p.manualAdjust||0))
      const used=Number(s.approvedTaken||0), left=Math.max(0,quota-used)
      const dates=expandDates(l.start,l.end); const days= l.days || dates.length
      if(l.type==='annual' && days>left){
        const ok = confirm(`此員工年假剩餘 ${left} 天，不足以核准 ${days} 天。
是否仍要超扣核准？`)
        if(!ok) return
      }

      const batch=writeBatch(db)
      // schedules/{uid}/{yyyymm}/{dd}
      let idx=0
      for(const ds of dates){
        idx+=1; const yyyymm=ds.slice(0,7).replace('-',''), dd=ds.slice(8,10)
        const dayRef = doc(db,'schedules', uid, yyyymm, dd)
        batch.set(dayRef, { leaveType:l.type, leaveIndex:idx, requiredHoursOverride:0, fromQuota:false,
          markedBy:auth.currentUser?.uid||null, markedAtTPE: nowTPE() }, {merge:true})
      }
      batch.update(ref,{status:'approved', approvedAtTPE: nowTPE(), approver:auth.currentUser?.uid||null})
      if(l.type==='annual'){
        const cur=(s && s.year===year)? Number(s.approvedTaken||0) : 0
        batch.update(uRef,{ leaveStats:{ year, approvedTaken: cur+days } })
      }
      await batch.commit(); alert('已核准並標註班表'); return refresh()
    }
  }
}
