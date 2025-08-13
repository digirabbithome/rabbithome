import { db, auth } from '/js/firebase.js'
import { addDoc, collection, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
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

  // migrate any legacy root "0" field to notes.0, once
  try{
    const ops = [];
    schedSnap.forEach(d => {
      const data = d.data();
      if (typeof data['0'] === 'string') {
        console.warn('[NOTE][MIGRATE][render]', d.id, 'moving 0 -> notes.0');
        const notes = (data && data.notes) || undefined;
        const cur = notes && typeof notes['0']==='string' ? notes['0'] : '';
        if (String(data['0']).trim() !== '' && (!cur || String(cur).trim()==='')) {
          ops.push(setDoc(doc(db,'schedules', viewingUid, yyyymm, d.id), { 'notes.0': data['0'], '0': deleteField() }, { merge:true }));
        }
      }
    });
    if (ops.length) { Promise.all(ops).then(()=>console.log('[NOTE][MIGRATE][render] done', ops.length)); }
  }catch(e){ console.warn('[NOTE][MIGRATE][render] error', e); }

  console.log('[NOTE][READ] renderMonth schedules snapshot', {
    viewingUid, y, m, yyyymm, count: schedSnap.size
  });
  schedSnap.forEach(d => {
    const data = d.data();
    console.log('[NOTE][READ] doc', d.id, data && data.notes);
  });

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
    const noteVal = (i) => {
      // Priority: notes.0 (map) > legacy root '0'
      if (notes && typeof notes[i] === 'string' && notes[i].trim() !== '') return notes[i];
      if (typeof daySched?.[i] === 'string' && String(daySched[i]).trim() !== '') return daySched[i];
      return '';
    }

    const tbodyEl = document.getElementById('tbody')
    if (segRows.length){
      segRows.forEach((r, i) => {
        tbodyEl.insertAdjacentHTML('beforeend', `
          <div class="tr">
            <span>${i===0?date:''}</span>
            <span>${r.tIn}</span>
            <span>${r.tOut}</span>
            <span>${r.h}${(i===0 && segRows.length>1)?`（合計 ${dayTotal.toFixed(1)}h）`:''}</span>
            <span>${i===0?diffBadge:''}</span>
            <span>${i===0?`${leaveTag}${isCompanyHoliday?' <span class=\"badge org\">公司</span>':''} ${renderAdminPen(keyDD)}`:''}</span>
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
          <span>${`${leaveTag}${isCompanyHoliday?' <span class=\"badge org\">公司</span>':''} ${renderAdminPen(keyDD)}`}</span>
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
  if (document._noteBound) return;
  document._noteBound = true;

  const ALLOW_CLEAR = false;
  const INPUT_DEBOUNCE_MS = 500;
  const timers = new Map();
  let composing = false;

  async function migrateLegacy(ref, snap){
    try{
      if (snap && snap.exists() && typeof snap.data()['0'] === 'string') {
        const legacy = snap.data()['0'];
        console.warn('[NOTE][MIGRATE] moving root 0 -> notes.0', legacy);
        await setDoc(ref, { 'notes.0': legacy, '0': deleteField() }, { merge: true });
      }
    }catch(e){ console.warn('[NOTE][MIGRATE] failed', e); }
  }

  async function save(el){
    if (!el) return;
    const ddRaw  = el.dataset.dd || '';
    const idx    = String(el.dataset.idx || '0');
    const yyyymm = `${y}${String(m).padStart(2,'0')}`;
    const dd     = String(ddRaw).padStart(2,'0') ;
    const val    = String(el.value ?? '');
    // Guard: Skip empty writes unless user explicitly cleared
    if ((val === '' || val === undefined) && !el.dataset.userCleared) {
      console.warn('[NOTE][SKIP EMPTY WRITE]', {dd: dd, idx: idx, reason: 'empty value'});
      return;
    }

    try {
      const ref  = doc(db,'schedules', viewingUid, yyyymm, dd); // ✅ always viewingUid
      const before = await getDoc(ref);
      await migrateLegacy(ref, before);

      if (!ALLOW_CLEAR) {
        const current = before.exists() && before.data() && before.data().notes ? before.data().notes : undefined;
        const oldVal  = current && typeof current[idx] === 'string' ? current[idx] : '';
        if (val.trim()==='' && oldVal.trim()!=='') {
          showToast('已略過空白，不覆蓋原備註');
          return;
        }
      }

      console.log('[NOTE][WRITE]', { path:`schedules/${viewingUid}/${yyyymm}/${dd}`, key:`notes.${idx}`, val });
      await setDoc(ref, { [`notes.${idx}`]: val, '0': deleteField() }, { merge:true });
// Strong readback from server
let back = (typeof getDocFromServer === 'function' ? await getDocFromServer(ref).catch(()=>null) : await getDoc(ref).catch(()=>null));
if (!back || !back.exists() || !((back.data()||{}).notes && String((back.data().notes||{})[idx]||'') === String(val))) {
  console.warn('[NOTE][VERIFY] mismatch, retry via updateDoc');
  try { await updateDoc(ref, { [`notes.${idx}`]: val, '0': deleteField() }); } catch(e) { console.warn('updateDoc retry failed', e); }
  await new Promise(r=>setTimeout(r,250));
  back = (typeof getDocFromServer === 'function' ? await getDocFromServer(ref).catch(()=>null) : await getDoc(ref).catch(()=>null));
}
try { console.log('[NOTE] READBACK after save', dd, { full: back && back.data && back.data(), notes: back && back.data && back.data().notes }); } catch(e){}
const after = await getDoc(ref);
      const n = after.exists() && after.data() && after.data().notes ? after.data().notes : undefined;
      console.log('[NOTE] READBACK after save', dd, n);
      showToast('備註已儲存');
    } catch (err) {
      console.error('備註儲存失敗', err);
      showToast('備註儲存失敗');
    }
  }

  document.addEventListener('compositionstart', e => {
    if (e.target && e.target.matches && e.target.matches('input.note')) composing = true;
  }, true);
  document.addEventListener('compositionend', e => {
    if (e.target && e.target.matches && e.target.matches('input.note')) composing = false;
  }, true);

  document.addEventListener('input', (e) => {
    const el = e.target && e.target.closest && e.target.closest('input.note');
    if (!el || composing) return;
    const key = `${el.dataset.dd || ''}/${el.dataset.idx || '0'}`;
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => save(el), INPUT_DEBOUNCE_MS));
  }, true);

  const direct = (e) => {
    const el = e.target && e.target.closest && e.target.closest('input.note');
    if (!el) return;
    setTimeout(() => save(el), 0);
  };
  document.addEventListener('focusout', direct, true);
  document.addEventListener('change',   direct, true);
})();






/** ===== 管理：當日工時/假別覆蓋（筆 icon） ===== */
function renderAdminPen(dd){
  const allowedAdmins = ['swimming8250@yahoo.com.tw','duckskin@yahoo.com.tw'];
  if (!me || !allowedAdmins.includes(me.email||'')) return '';
  return `<button class="btn-pen" data-dd="${dd}" title="管理：調整工時/假別">✎</button>`;
}


// ✎：管理個人/全店當日工時與休假
document.addEventListener('click', async (e) => {
  const btn = e.target && e.target.closest && e.target.closest('.btn-pen');
  if (!btn) return;

  const dd = String(btn.dataset.dd || '').padStart(2, '0');
  const yyyymm = `${y}${String(m).padStart(2,'0')}`;
  const refPersonal = doc(db, 'schedules', viewingUid, yyyymm, dd);
  const refStore    = doc(db, 'orgSchedules', yyyymm, 'days', dd);

  const scope = prompt(
    `調整日期：${y}-${String(m).padStart(2,'0')}-${dd}\n` +
    `請選擇作用範圍：\n` +
    `1 = 只調整目前這位（個人）\n` +
    `2 = 套用全店（所有人）`
  );
  if (!scope) return;
  const isStore = (scope === '2');

  const choice = prompt(
    `選擇要做的事（${isStore ? '全店' : '個人'}）：\n` +
    `1 = 設定「應工時」（小時）\n` +
    `2 = 設為「休假（工時 0）」\n` +
    `3 = 清除覆蓋（恢復預設）`
  );
  if (!choice) return;

  try {
    if (choice === '1') {
      const hoursStr = prompt('請輸入應工時（例如 9、7、0.5）：', '9');
      if (hoursStr == null) return;
      const hours = Number(hoursStr);
      if (Number.isNaN(hours)) { alert('請輸入數字'); return; }

      if (isStore) {
        await setDoc(refStore, {
          requiredHoursOverride: hours,
          name: deleteField()
        }, { merge: true });
      
      try { showToast('全店已更新'); } catch(e){};
} else {
        await setDoc(refPersonal, {
          requiredHoursOverride: hours,
          leaveType: deleteField(),
          leaveIndex: deleteField()
        }, { merge: true });
      
      try { showToast('個人已更新'); } catch(e){};
}
      showToast(`${isStore?'全店':'個人'}已設定應工時：${hours}h`);

    } else if (choice === '2') {
      if (isStore) {
        const name = prompt('公司休假名稱（可留空）：', '公司休假');
        await setDoc(refStore, {
          requiredHoursOverride: 0,
          ...(name ? { name } : { name: deleteField() })
        }, { merge: true });
      
      try { showToast('全店已更新'); } catch(e){};
} else {
        await setDoc(refPersonal, {
          requiredHoursOverride: 0,
          leaveType: 'personal',
          leaveIndex: deleteField()
        }, { merge: true });
      
      try { showToast('個人已更新'); } catch(e){};
}
      showToast(`${isStore?'全店':'個人'}已設定為休假（工時 0）`);

    } else if (choice === '3') {
      if (isStore) {
        await setDoc(refStore, {
          requiredHoursOverride: deleteField(),
          name: deleteField()
        }, { merge: true });
      
      try { showToast('全店已更新'); } catch(e){};
} else {
        await setDoc(refPersonal, {
          requiredHoursOverride: deleteField(),
          leaveType: deleteField(),
          leaveIndex: deleteField()
        }, { merge: true });
      
      try { showToast('個人已更新'); } catch(e){};
}
      showToast(`${isStore?'全店':'個人'}已清除覆蓋，恢復預設`);
    } else {
      return;
    }

    await renderMonth();

  } catch (err) {
    console.error('管理更新失敗', err);
    alert('更新失敗，請稍後再試');
  }
});

// extra logging for admin pen paths
document.addEventListener('click', (e)=>{
  const btn = e.target && e.target.closest && e.target.closest('.btn-pen');
  if (!btn) return;
  const dd = String(btn.dataset.dd || '').padStart(2,'0');
  const yyyymm = `${y}${String(m).padStart(2,'0')}`;
  console.log('[ADMIN] writes will target', { personal:`schedules/${viewingUid}/${yyyymm}/${dd}`, store:`orgSchedules/${yyyymm}/days/${dd}` });
}, true);