import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, getDocs,
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

/** ===== 共用工具（台北時間） ===== */
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' })
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour:'2-digit', minute:'2-digit', hour12:false })
const toISODate = (d) => fmtDate.format(d)                // YYYY-MM-DD
const toHM = (d) => fmtTime.format(d)                     // HH:mm:ss → 取前5位
const pad2 = (n) => String(n).padStart(2,'0')
const isWeekend = (dt) => { const w = dt.getDay(); return w===0 || w===6 }

/** 0.5 小時規則 */
const floorToHalf = (h) => Math.floor(h*2)/2       // 用於加班（捨去）
const ceilToHalf  = (h) => Math.ceil(h*2)/2        // 用於不足（進位）

/** 狀態變數 */
let me = null
let viewingUid = null
let y = 0, m = 0    // 檢視的年/月（數字）
let todayNextKind = 'in'
const allowedAdmins = ['swimming8250@yahoo.com.tw','duckskin@yahoo.com.tw']

/** 啟動 */
window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return }
    me = user
    const params = new URLSearchParams(location.search)
    const target = params.get('uid')
    viewingUid = target && allowedAdmins.includes(me.email||'') ? target : me.uid

    // 顯示使用者暱稱/名稱 → 「xxx 的出勤日記」
    const uSnap = await getDoc(doc(db,'users',viewingUid))
    const u = uSnap.exists()? uSnap.data(): {}
    const alias = u.nickname || u.name || (me.email||'').split('@')[0] || '使用者'
    document.getElementById('pageTitle').textContent = `${alias} 的出勤日記`
    document.getElementById('who').textContent = me.email || ''

    // 初始化月份
    const now = new Date()
    y = now.getFullYear(); m = now.getMonth()+1
    const mp = document.getElementById('monthPicker')
    mp.value = `${y}-${pad2(m)}`
    mp.onchange = () => { const [yy,mm] = mp.value.split('-').map(Number); y=yy; m=mm; renderMonth() }
    document.getElementById('prevM').onclick = () => { const d=new Date(y, m-2, 1); y=d.getFullYear(); m=d.getMonth()+1; mp.value=`${y}-${pad2(m)}`; renderMonth() }
    document.getElementById('nextM').onclick = () => { const d=new Date(y, m, 1); y=d.getFullYear(); m=d.getMonth()+1; mp.value=`${y}-${pad2(m)}`; renderMonth() }

    // 打卡按鈕（僅本人可打）
    const punchBar = document.getElementById('punchBar')
    if (viewingUid !== me.uid) punchBar.style.display='none'
    document.getElementById('btnIn').onclick  = () => punch('in')
    document.getElementById('btnOut').onclick = () => punch('out')
    setInterval(()=>{
      const d=new Date(); document.getElementById('nowTPE').textContent = toISODate(d)+' '+toHM(d).slice(0,5)+' (GMT+8)'
    }, 1000)

    await renderMonth()
  })
}

/** 設定打卡按鈕的狀態（只能交替） */
function setPunchButtons(next){
  todayNextKind = next
  const btnIn = document.getElementById('btnIn')
  const btnOut = document.getElementById('btnOut')
  if (next === 'in'){
    btnIn.disabled = false
    btnOut.disabled = true
  }else{
    btnIn.disabled = true
    btnOut.disabled = false
  }
}

/** 依今日 raw punches 計算下一步應該顯示哪顆按鈕 */
function computeTodayNextKind(rawList){
  if (!rawList || !rawList.length) return 'in'
  const sorted = rawList.map(p => ({
    kind: p.kind,
    t: p.at ? new Date(p.at) : (p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.atTPE.replace(' ','T')))
  })).sort((a,b)=>a.t-b.t)
  const last = sorted[sorted.length-1]
  return last.kind === 'in' ? 'out' : 'in'
}

/** 打卡（沿用 punches/{uid}/{yyyymm} 一筆一打） */
async function punch(kind){
  if (kind !== todayNextKind) {
    showToast(kind==='in' ? '需先下班打卡，才能再次上班' : '需先上班打卡，才能下班')
    return
  }
  const btnIn = document.getElementById('btnIn')
  const btnOut = document.getElementById('btnOut')
  btnIn.disabled = true; btnOut.disabled = true

  const d = new Date()
  const localDate = toISODate(d)
  const localTime = toHM(d).slice(0,5)
  const yyyymm = localDate.slice(0,7).replace('-','')
  try{
    await addDoc(collection(db, 'punches', me.uid, yyyymm), {
      date: localDate,
      kind,
      at: d.toISOString(),
      atTPE: `${localDate} ${localTime}`,
      tz: 'Asia/Taipei',
      createdAt: serverTimestamp()
    })
    showToast(`打卡成功：${kind==='in'?'上班':'下班'} ${localTime}`)
    await renderMonth()
  }catch(err){
    showToast('打卡失敗，請再試一次')
  }
}

/** 讀取月資料並渲染 */
async function renderMonth(){
  const tbody = document.getElementById('tbody')
  tbody.innerHTML = '載入中…'
  const yyyymm = `${y}${pad2(m)}`
  const daysInMonth = new Date(y, m, 0).getDate()
  const todayStr = toISODate(new Date())

  // punches（原始一筆一打）
  const punchesSnap = await getDocs(collection(db,'punches', viewingUid, yyyymm))
  const raw = []; punchesSnap.forEach(d => raw.push(d.data()))
  const byDateRaw = {}
  for (const p of raw){
    const ds = p.date || (p.atTPE ? p.atTPE.slice(0,10) : (p.at ? String(p.at).slice(0,10) : ''))
    if (!ds) continue
    ;(byDateRaw[ds] ||= []).push(p)
  }

  // 依今日 raw 設定按鈕交替狀態
  const todayRaw = byDateRaw[toISODate(new Date())] || []
  setPunchButtons(computeTodayNextKind(todayRaw))

  // 轉成多段 session
  const sessionsByDate = {}
  for (const [ds,list] of Object.entries(byDateRaw)){
    const sorted = list.map(p => ({
      kind: p.kind,
      t: p.at ? new Date(p.at) : (p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.atTPE.replace(' ','T')))
    })).sort((a,b)=>a.t-b.t)
    const sessions = []; let cur=null
    for (const r of sorted){
      if (r.kind==='in'){ cur = { in:r.t } }
      else if (r.kind==='out' && cur && !cur.out){ cur.out=r.t; sessions.push(cur); cur=null }
    }
    sessionsByDate[ds] = sessions
  }

  // schedules（個人假別、應工時覆蓋、備註）
  const sched = {}
  const schedSnap = await getDocs(collection(db,'schedules', viewingUid, yyyymm))
  schedSnap.forEach(d=>{ sched[d.id.padStart(2,'0')] = d.data() }) // dd -> data

  // orgSchedules（公司層級覆蓋 & 名稱）→ 使用子集合 days
  const org = {}
  const orgSnap = await getDocs(collection(db,'orgSchedules', yyyymm, 'days'))
  orgSnap.forEach(d=>{ org[d.id.padStart(2,'0')] = d.data() })

  // 計算＆渲染
  tbody.innerHTML = ''
  let monthTotal = 0
  let autoRestCount = 0

  for(let dd=1; dd<=daysInMonth; dd++){
    const date = `${y}-${pad2(m)}-${pad2(dd)}`
    // 未來日期不顯示
    if (date > todayStr) continue

    const day = new Date(`${date}T00:00:00`)
    const weekend = isWeekend(day)
    const keyDD = pad2(dd)
    const daySched = sched[keyDD] || {}
    const orgSched = org[keyDD] || {}
    const sessions = sessionsByDate[date] || []

    // 應工時：個人 > 公司 > 週末/平日
    let required = (typeof daySched.requiredHoursOverride === 'number')
      ? Number(daySched.requiredHoursOverride)
      : (typeof orgSched.requiredHoursOverride === 'number')
        ? Number(orgSched.requiredHoursOverride)
        : (weekend ? 7 : 9)

    // 假別顯示（優先個人，否則公司）
    let leaveTag = '—'
    let isCompanyHoliday = false
    if (daySched.leaveType){
      const cn = daySched.leaveType==='annual' ? '年假' : (daySched.leaveType==='personal' ? '事假' : daySched.leaveType)
      leaveTag = daySched.leaveIndex ? `${cn}${daySched.leaveIndex}` : cn
      if (typeof daySched.requiredHoursOverride !== 'number' && required===0) {
        // 個人假且沒特別設，維持 required=0
      }
    } else if (typeof orgSched.requiredHoursOverride === 'number' && orgSched.requiredHoursOverride===0){
      isCompanyHoliday = true
      leaveTag = `公司休假${orgSched.name?`（${orgSched.name}）`:''}`
      // 不占用月休（下面月休邏輯會避開 isCompanyHoliday）
    } else if (!sessions.length){
      // 沒打卡且無請假 → 自動月休 1..7（僅顯示）
      if (autoRestCount < 7){
        autoRestCount += 1
        leaveTag = `月休${autoRestCount}`
        required = 0
      }
    }

    // 逐段工時（到 0.5）：單段小時計，最後合計
    const segRows = []
    let dayTotal = 0
    sessions.forEach((seg, idx) => {
      const h = Math.max(0, (seg.out - seg.in) / 3600000)  // 精確到小時
      const hRound = Math.floor(h*2)/2                      // 每段捨去到 0.5
      dayTotal += hRound
      const tIn = toHM(seg.in).slice(0,5)
      const tOut = toHM(seg.out).slice(0,5)
      segRows.push({ tIn, tOut, h: hRound.toFixed(1), idx })
    })
    monthTotal += dayTotal

    // 差異（正→加班捨去，負→不足進位）
    const diff = dayTotal - required
    const overtime = diff>0 ? floorToHalf(diff) : 0
    const shortage = diff<0 ? ceilToHalf(Math.abs(diff)) : 0
    const diffBadge = diff===0 ? '—'
      : (diff>0 ? `<span class="badge plus">+${overtime.toFixed(1)}</span>`
                : `<span class="badge minus">-${shortage.toFixed(1)}</span>`)

    // 備註資料： schedules/{uid}/{yyyymm}/{dd}.notes[segmentIndex]
    const notes = (daySched.notes && typeof daySched.notes === 'object') ? daySched.notes : {}
    const noteVal = (i) => (notes && typeof notes[i]==='string') ? notes[i] : ''

    const tbodyEl = document.getElementById('tbody')
    if (segRows.length){
      segRows.forEach((r, i) => {
        tbodyEl.insertAdjacentHTML('beforeend', `
          <div class="tr">
            <span>${i===0?date:''}</span>
            <span>${r.tIn}</span>
            <span>${r.tOut}</span>
            <span>${r.h}${i===0?`（合計 ${dayTotal.toFixed(1)}h）`:''}</span>
            <span>${i===0?diffBadge:''}</span>
            <span>${i===0?`${leaveTag}${isCompanyHoliday?' <span class="badge org">公司</span>':''}`:''}</span>
            <span>${renderNoteInput(keyDD, i, noteVal(i))}</span>
          </div>
        `)
      })
    } else {
      // 無打卡 → 單行（顯示假別/月休/—）
      tbodyEl.insertAdjacentHTML('beforeend', `
        <div class="tr">
          <span>${date}</span>
          <span>—</span><span>—</span>
          <span>0.0</span>
          <span>${diffBadge}</span>
          <span>${`${leaveTag}${isCompanyHoliday?' <span class="badge org">公司</span>':''}`}</span>
          <span>${renderNoteInput(keyDD, 0, noteVal(0))}</span>
        </div>
      `)
    }

    // 管理者鉛筆（應工時：個人 / 公司）
    if (allowedAdmins.includes(me.email||'')){
      const targetTr = document.getElementById('tbody').lastElementChild
      const cell = targetTr.children[5] // 假別欄位
      const reqEditor = document.createElement('span')
      reqEditor.className = 'td-req'
      reqEditor.style.marginLeft = '6px'
      const orgChecked = typeof orgSched.requiredHoursOverride === 'number'
      reqEditor.innerHTML = `
        <button class="icon" title="調整應工時" data-dd="${keyDD}">✏️</button>
        <small class="muted">${required.toFixed(1)}h</small>
        <label style="display:none;align-items:center;gap:6px;" class="editor">
          <input type="number" step="0.5" min="0" value="${required.toFixed(1)}" class="reqInput">
          <label style="display:flex;align-items:center;gap:4px;">
            <input type="checkbox" class="applyOrg" ${orgChecked?'checked':''}> 套用全公司
          </label>
          <input type="text" class="orgName" placeholder="公司假別名稱（如：春節）" value="${orgSched.name or ''}">
          <button class="icon saveBtn">💾</button>
          <small class="muted saveTip" style="margin-left:6px"></small>
        </label>
      `
      cell.appendChild(reqEditor)
      const btn = reqEditor.querySelector('button')
      const editor = reqEditor.querySelector('.editor')
      const input = reqEditor.querySelector('.reqInput')
      const applyOrg = reqEditor.querySelector('.applyOrg')
      const orgName = reqEditor.querySelector('.orgName')
      const saveBtn = reqEditor.querySelector('.saveBtn')
      const tip = reqEditor.querySelector('.saveTip')

      btn.onclick = () => { editor.style.display = editor.style.display==='none' ? 'flex' : 'none'; input.focus(); input.select() }
      const save = async ()=>{
        const v = Number(input.value)
        const yyyymm2 = `${y}${pad2(m)}`
        try{
          if (applyOrg.checked){
            const ref = doc(db,'orgSchedules', yyyymm2, 'days', pad2(parseInt(btn.dataset.dd)))
            await setDoc(ref, { requiredHoursOverride: v, name: orgName.value or None }, { merge:true })
          } else {
            const ref = doc(db,'schedules', viewingUid, yyyymm2, btn.dataset.dd)
            await setDoc(ref, { requiredHoursOverride: v }, { merge:true })
          }
          tip.textContent = '✅ 已儲存'; tip.style.display='inline'
          setTimeout(()=> tip.style.display='none', 1500)
          await renderMonth()
        }catch(e){
          tip.textContent = '❌ 失敗'; tip.style.display='inline'
        }
      }
      saveBtn.onclick = save
      input.addEventListener('keydown', e=>{ if (e.key==='Enter') save() })
    }
  }

  document.getElementById('monthSum').textContent = `本月總工時：${monthTotal.toFixed(1)} 小時`
  bindNoteEvents(yyyymm)
}

/** 備註欄輸入框 HTML */
function renderNoteInput(dd, idx, val){
  const v = (val||'').replace(/"/g,'&quot;')
  return `<input class="note" data-dd="${dd}" data-idx="${idx}" value="${v}" placeholder="備註…（離開欄位即自動儲存）">`
}

/** 綁定備註事件 */
function bindNoteEvents(yyyymm){
  document.querySelectorAll('input.note').forEach(inp => {
    inp.addEventListener('blur', async (e)=>{
      const dd = inp.dataset.dd, idx = inp.dataset.idx
      const ref = doc(db,'schedules', viewingUid, yyyymm, dd)
      try{
        await setDoc(ref, { notes: { [idx]: inp.value } }, { merge:true })
        showInlineTip(inp, '✅ 已儲存', true)
      }catch(err){
        showInlineTip(inp, '❌ 失敗', false)
      }
    })
  })
}

/** 行內提示 */
function showInlineTip(inputEl, text, ok){
  const tip = document.createElement('span')
  tip.className = `badge ${ok?'note-ok':'note-err'}`
  tip.textContent = text
  tip.style.marginLeft = '6px'
  inputEl.insertAdjacentElement('afterend', tip)
  setTimeout(()=> tip.remove(), 1200)
}

/** Toast */
function showToast(text){
  const el = document.getElementById('toast')
  el.textContent = text
  el.style.display = 'block'
  setTimeout(()=> el.style.display='none', 1600)
}
