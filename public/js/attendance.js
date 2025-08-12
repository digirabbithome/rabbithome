import { db, auth } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, getDocs, setDoc, doc, getDoc
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
    viewingUid = target && ['swimming8250@yahoo.com.tw','duckskin@yahoo.com.tw'].includes(me.email||'') ? target : me.uid

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
    // ★ 上班打卡：先在 UI 插入暫時列（即時可見）
    if (kind === 'in') {
      renderPendingInRow(localDate, localTime)
      setPunchButtons('out')
    }
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
    if (kind === 'in') setPunchButtons('in')
  }
}

/** 讀取月資料並渲染（全部使用子集合，不會觸發 Firestore 複合索引） */
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

  // 轉成多段 session（最後只有 in 沒 out 也要顯示）
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
    if (cur && !cur.out){ sessions.push(cur) } // 仍顯示上班時間，工時 0.0，下班 —
    sessionsByDate[ds] = sessions
  }

  // schedules（個人假別、應工時覆蓋、備註）
  const sched = {}
  const schedSnap = await getDocs(collection(db,'schedules', viewingUid, yyyymm))
  schedSnap.forEach(d=>{ sched[d.id.padStart(2,'0')] = d.data() })

  // orgSchedules（公司層級覆蓋 & 名稱）
  const org = {}
  const orgSnap = await getDocs(collection(db,'orgSchedules', yyyymm, 'days'))
  orgSnap.forEach(d=>{ org[d.id.padStart(2,'0')] = d.data() })

  // 計算＆渲染
  tbody.innerHTML = ''
  let monthTotal = 0
  let diffTotal = 0
  let autoRestCount = 0

  for(let dd=1; dd<=daysInMonth; dd++){
    const date = `${y}-${pad2(m)}-${pad2(dd)}`
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

    // 假別顯示
    let leaveTag = '—'
    let isCompanyHoliday = false
    if (daySched.leaveType){
      const cn = daySched.leaveType==='annual' ? '年假' : (daySched.leaveType==='personal' ? '事假' : daySched.leaveType)
      leaveTag = daySched.leaveIndex ? `${cn}${daySched.leaveIndex}` : cn
    } else if (typeof orgSched.requiredHoursOverride === 'number' && orgSched.requiredHoursOverride===0){
      isCompanyHoliday = true
      leaveTag = `公司休假${orgSched.name ? `（${orgSched.name}）` : ''}`
    } else if (!sessions.length){
      if (autoRestCount < 7){
        autoRestCount += 1
        leaveTag = `月休${autoRestCount}`
        required = 0
      }
    }

    // 逐段工時（未完成段顯示 0.0）
    const segRows = []
    let dayTotal = 0
    sessions.forEach((seg, idx) => {
      const hasOut = !!seg.out
      const h = hasOut ? Math.max(0, (seg.out - seg.in) / 3600000) : 0
      const hRound = hasOut ? Math.floor(h*2)/2 : 0
      dayTotal += hRound
      const tIn = toHM(seg.in).slice(0,5)
      const tOut = hasOut ? toHM(seg.out).slice(0,5) : '—'
      segRows.push({ tIn, tOut, h: hRound.toFixed(1), idx })
    })
    monthTotal += dayTotal

    // 差異（加班捨去 / 不足進位）
    const diff = dayTotal - required
    const overtime = diff>0 ? floorToHalf(diff) : 0
    const shortage = diff<0 ? ceilToHalf(Math.abs(diff)) : 0
    const dayNet = overtime - shortage
    diffTotal += dayNet

    const diffBadge = diff===0 ? '—'
      : (diff>0 ? `<span class="badge plus">+${overtime.toFixed(1)}</span>`
                : `<span class="badge minus">-${shortage.toFixed(1)}</span>`)

    // 備註
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
  }

  // 顯示工時合計 + 差異合計
  const diffText = `${diffTotal >= 0 ? '+' : ''}${diffTotal.toFixed(1)} h`
  document.getElementById('monthSum').textContent =
    `本月總工時：${monthTotal.toFixed(1)} 小時　差異合計：${diffText}`
}

/** 上班打卡後的暫時列（即時可見） */
function renderPendingInRow(dateStr, timeHM){
  const tbody = document.getElementById('tbody');
  const row = document.createElement('div');
  row.className = 'tr';
  row.dataset.temp = '1';
  row.innerHTML = `
    <span>${dateStr}</span>
    <span>${timeHM}</span>
    <span>—</span>
    <span>0.0</span>
    <span>—</span>
    <span>—</span>
    <span>${renderNoteInput(dateStr.slice(-2), 0, '')}</span>
  `;
  // append to end (today is last row)
  tbody.appendChild(row);
  // visual hint
  try {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(()=> row.classList.remove('flash'), 800);
  } catch(e) {}
}

/** 備註欄輸入框（預設空白，blur 儲存） */
function renderNoteInput(dd, idx, val){
  const v = (val||'').replace(/"/g,'&quot;')
  return `<input class="note" data-dd="${dd}" data-idx="${idx}" value="${v}">`
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


// ===== 備註即時儲存（穩定版：focusout + change；只綁一次） =====
(function bindNoteAutoSave(){
  const tbody = document.getElementById('tbody');
  if (!tbody || tbody._noteBound) return;
  tbody._noteBound = true;

  async function save(el){
    if (!el) return;
    const ddRaw = el.dataset.dd || '';
    const idx   = String(el.dataset.idx || '0');
    const val   = el.value || '';
    const yyyymm = `${y}${String(m).padStart(2,'0')}`;
    const dd     = String(ddRaw).padStart(2,'0');

    try {
      await setDoc(
        doc(db,'schedules', viewingUid, yyyymm, dd),
        { [`notes.${idx}`]: val },
        { merge: true }
      );
      el.classList.add('saved-ok');
      setTimeout(()=> el.classList.remove('saved-ok'), 800);
    } catch (err) {
      console.error('備註儲存失敗', err);
      el.classList.add('saved-fail');
      setTimeout(()=> el.classList.remove('saved-fail'), 1200);
    }
  }

  const direct = (e) => {
    const el = e.target && e.target.closest && e.target.closest('input.note');
    if (!el) return;
    save(el);
  };
  tbody.addEventListener('focusout', direct, true);
  tbody.addEventListener('change',   direct, true);
})();
