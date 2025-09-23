import { db, auth } from '/js/firebase.js'
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// 老闆白名單（只有這兩個能回覆）
const MANAGER_EMAILS = new Set([
  'swimming8250@yahoo.com.tw',
  'duckskin71@yahoo.com.tw'
])

// 日期（台北時區）
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' })
const fmtHM = new Intl.DateTimeFormat('zh-TW', { timeZone:'Asia/Taipei', hour:'2-digit', minute:'2-digit', hour12:false })
function todayYMD(){ return fmtDate.format(new Date()) }            // YYYY-MM-DD
function addDays(ymd, delta){ const d = new Date(ymd); d.setDate(d.getDate()+delta); return fmtDate.format(d) }
function weekdayShort(ymd){
  const d = new Date(ymd);
  return ['日','一','二','三','四','五','六'][d.getDay()];
}
function formatDayWithWeekday(ymd){
  return `${ymd}（${weekdayShort(ymd)}）`;
}

// 狀態
let me = null
let myNickname = '—'
let canReply = false        // 只有老闆可回覆
let selectedScope = 'all'   // 所有人預設「全部」
let docs60 = []             // 最近 60 天（供搜尋）
let docs30 = []             // 最近 30 天（供下方列表）

// DOM
const whoami = document.getElementById('whoami')
const todayLabel = document.getElementById('todayLabel')
const rangeText = document.getElementById('rangeText')
const searchInput = document.getElementById('searchInput')
const reportTitle = document.getElementById('reportTitle')
const editor = document.getElementById('editor')
const btnSave = document.getElementById('btnSave')
const reportList = document.getElementById('reportList')
const toastEl = document.getElementById('toast')
const viewAllRadio = document.getElementById('viewAll')
const viewMineRadio = document.getElementById('viewMine')

// Toolbar
const btnUndo = document.getElementById('btnUndo')
const btnRedo = document.getElementById('btnRedo')
const btnClear = document.getElementById('btnClear')
const foreColor = document.getElementById('foreColor')
const backColor = document.getElementById('backColor')

// 選取範圍保存
let savedRange = null
function saveSelection(){ const sel = window.getSelection(); if(sel && sel.rangeCount>0) savedRange = sel.getRangeAt(0) }
function restoreSelection(){ if(savedRange){ const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange) } }
editor.addEventListener('keyup', saveSelection)
editor.addEventListener('mouseup', saveSelection)

// 入口
window.onload = () => {
  onAuthStateChanged(auth, async user => {
    if (!user) { alert('請先登入'); return }
    me = user
    canReply = MANAGER_EMAILS.has((me.email || '').toLowerCase())

    whoami.textContent = `${me.displayName || me.email || '使用者'}${canReply ? '（老闆）' : ''}`
    todayLabel.textContent = `${todayYMD()} ${fmtHM.format(new Date())}`

    try {
      const uref = doc(db, 'users', me.uid)
      const usn = await getDoc(uref)
      if (usn.exists() && usn.data().nickname) myNickname = usn.data().nickname
      else myNickname = me.displayName || me.email || '匿名'
    } catch {
      myNickname = me.displayName || me.email || '匿名'
    }

    bindToolbar()
    bindControls()
    await loadRecent60Days()

    // 填入今日資料（若有）
    const todayDoc = docs60.find(d => d.uid===me.uid && d.date===todayYMD())
    editor.innerHTML = todayDoc?.contentHtml || ''
    reportTitle.value = todayDoc?.title || ''
  })
}

function bindToolbar(){
  document.querySelectorAll('.dr-toolbar [data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.execCommand(btn.getAttribute('data-cmd'))
      editor.focus()
    })
  })
  btnUndo.addEventListener('click', ()=>document.execCommand('undo'))
  btnRedo.addEventListener('click', ()=>document.execCommand('redo'))
  btnClear.addEventListener('click', ()=>document.execCommand('removeFormat'))
  try { document.execCommand('styleWithCSS', false, true) } catch {}
  foreColor.addEventListener('change', ()=>{ restoreSelection(); document.execCommand('foreColor', false, foreColor.value); editor.focus() })
  backColor.addEventListener('change', ()=>{ restoreSelection(); if(!document.execCommand('hiliteColor', false, backColor.value)){ document.execCommand('backColor', false, backColor.value) } editor.focus() })
}

function bindControls(){

// --- autosave helpers ---
let _autosaveTimer = null;
function debounceSave(){
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(()=>saveToday(true), 1500);
}
// autosave on inputs
editor.addEventListener('input', debounceSave);
reportTitle.addEventListener('input', debounceSave);
// autosave when user leaves / tab hidden
window.addEventListener('visibilitychange', ()=>{
  if (document.visibilityState === 'hidden') { saveToday(true); }
});
window.addEventListener('pagehide', ()=>{ saveToday(true); });

  const btnGoProgress = document.getElementById('btnGoProgress');
  if (btnGoProgress){
    btnGoProgress.addEventListener('click', ()=>{
      const sec = document.getElementById('recordsSection') || reportList;
      if (sec && sec.scrollIntoView){
        sec.scrollIntoView({behavior:'smooth', block:'start'});
        toast('已定位到工作紀錄');
      }
    })
  }

  viewAllRadio.addEventListener('change', ()=>{ selectedScope='all'; renderList() })
  viewMineRadio.addEventListener('change', ()=>{ selectedScope='mine'; renderList() })
  searchInput.addEventListener('input', renderList)
  btnSave.addEventListener('click', saveToday)
}

// 儲存今天
async function saveToday(silent=false){
  const date = todayYMD()
  const id = `${me.uid}_${date}`
  const ref = doc(db, 'workReports', id)
  const data = {
    uid: me.uid,
    author: { email: me.email || '', nickname: myNickname },
    date,
    monthKey: date.slice(0,7),
    title: (reportTitle.value||'').trim(),
    contentHtml: editor.innerHTML,
    plainText: editor.innerText || '',
    updatedAt: serverTimestamp(),
  }
  const snap = await getDoc(ref)
  if (snap.exists()){
    await updateDoc(ref, data)
    if(!silent) toast('已更新今天的回報')
  } else {
    data.createdAt = serverTimestamp()
    await setDoc(ref, data)
    if(!silent) toast('已建立今天的回報')
  }
  await loadRecent60Days()
}

// 載入最近 60 天

async function loadRecent60Days(){
  const end = todayYMD()
  const start60 = addDays(end, -59) // 60 天
  const start30 = addDays(end, -29) // 30 天

  // 頂部仍顯示 60 天範圍
  rangeText.textContent = `${start60} ~ ${end}`

  const base = collection(db, 'workReports')

  // 60 天（搜尋池）
  const q60 = query(base, where('date','>=', start60), orderBy('date','desc'))
  const qs60 = await getDocs(q60)
  docs60 = qs60.docs.map(d => ({ id: d.id, ...d.data() }))

  // 30 天（顯示池）
  const q30 = query(base, where('date','>=', start30), orderBy('date','desc'))
  const qs30 = await getDocs(q30)
  docs30 = qs30.docs.map(d => ({ id: d.id, ...d.data() }))

  renderList()
}


// 渲染（以日期分組）
function renderList(){
  const kw = (searchInput.value||'').trim().toLowerCase()

  // 先依關鍵字與視角過濾
  const basePool = kw ? docs60 : docs30;
  let pool = basePool.filter(d => {
    if (selectedScope==='mine' && d.uid !== me.uid) return false
    if (kw){
      const hay = [(d.title||''), (d.plainText||''), (d.author?.nickname||'')].join(' ').toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })

  // 依日期分組
  const byDate = new Map()
  for (const d of pool){
    if (!byDate.has(d.date)) byDate.set(d.date, [])
    byDate.get(d.date).push(d)
  }

  // 依日期排序（新到舊）
  const days = Array.from(byDate.keys()).sort((a,b)=> a<b?1:-1)

  reportList.innerHTML = ''
  if (days.length===0){
    reportList.innerHTML = '<li class="day-card"><div class="day-head"><div class="day-date">沒有資料</div><div class="day-meta">請調整篩選或明天再來</div></div></li>';
    return
  }

  for (const day of days){
    const card = document.createElement('li')
    card.className = 'day-card'

    const head = document.createElement('div')
    head.className = 'day-head'
    head.innerHTML = `<div class="day-date">📅 ${formatDayWithWeekday(day)}</div><div class="day-meta">共 ${byDate.get(day).length} 則</div>`

    const body = document.createElement('div')
    body.className = 'day-body'

    // 這一天的每位同事
    for (const d of byDate.get(day)){
      const box = document.createElement('div')
      box.className = 'person-item'

      const head2 = document.createElement('div')
      head2.className = 'person-head'
      head2.innerHTML = `
        <div class="person-name">${escapeHtml(d.author?.nickname || '—')}</div>
        <div class="person-title">${escapeHtml(d.title || '(無標題)')}</div>
      `

      const content = document.createElement('div')
      content.className = 'person-content'
      content.innerHTML = d.contentHtml || ''

      // 先把姓名與內容放入卡片
      box.appendChild(head2)
      box.appendChild(content)

      // 回覆區塊（有回覆才顯示列表；老闆永遠可回覆，但 0 筆時不顯示 (0) 計數）
      const replies = Array.isArray(d.replies) ? d.replies : []

      // 1) 有回覆 → 顯示回覆區與清單（同事/老闆都會看到）
      if (replies.length > 0) {
        const sorted = [...replies].sort((a,b)=>{
          const as = a?.createdAt?.seconds || 0
          const bs = b?.createdAt?.seconds || 0
          return as-bs
        })
        const latest = sorted[sorted.length-1]
        const latestWho = (latest?.boss?.nickname || latest?.boss?.email || '老闆')
        const latestWhen = latest?.createdAt?.seconds ? new Date(latest.createdAt.seconds*1000).toLocaleString('zh-TW') : ''

        const replyWrap = document.createElement('div')
        replyWrap.className = 'reply-wrap'
        replyWrap.innerHTML = `<div class="reply-meta">💬 ${escapeHtml(latestWho)}（${replies.length}）${latestWhen ? '｜'+latestWhen : ''}</div>`

        for (let i=0; i<sorted.length; i++){
          const r = sorted[i]
          const item = document.createElement('div')
          item.className = 'reply-item'
          item.textContent = r?.text || ''
          replyWrap.appendChild(item)
        }

        if (canReply){
          const form = document.createElement('div')
          form.className = 'reply-form'
          form.innerHTML = `
            <input class="reply-input" type="text" placeholder="回覆給 ${escapeHtml(d.author?.nickname || '同事')}…" />
            <button class="reply-btn">送出回覆</button>
          `
          const input = form.querySelector('input')
          const btn = form.querySelector('button')
          btn.addEventListener('click', async ()=>{
            const text = (input.value||'').trim()
            if (!text) return
            const ref = doc(db, 'workReports', d.id)
            const snap = await getDoc(ref)
            const current = (snap.exists() && Array.isArray(snap.data().replies)) ? snap.data().replies.slice() : []
            current.push({
              boss: { email: me.email || '', nickname: myNickname || '老闆' },
              text,
              createdAt: Timestamp.now()
            })
            await updateDoc(ref, { replies: current })
            input.value = ''
            toast('已送出回覆')
            await loadRecent60Days()
          })
          replyWrap.appendChild(form)
        }
        box.appendChild(replyWrap)
      } else if (canReply) {
        // 2) 無回覆且為老闆 → 只顯示輸入框（不顯示 (0) 計數）
        const replyWrap = document.createElement('div')
        replyWrap.className = 'reply-wrap'
        replyWrap.innerHTML = `<div class="reply-meta">💬 老闆回覆</div>`
        const form = document.createElement('div')
        form.className = 'reply-form'
        form.innerHTML = `
          <input class="reply-input" type="text" placeholder="回覆給 ${escapeHtml(d.author?.nickname || '同事')}…" />
          <button class="reply-btn">送出回覆</button>
        `
        const input = form.querySelector('input')
        const btn = form.querySelector('button')
        btn.addEventListener('click', async ()=>{
          const text = (input.value||'').trim()
          if (!text) return
          const ref = doc(db, 'workReports', d.id)
          const snap = await getDoc(ref)
          const current = (snap.exists() && Array.isArray(snap.data().replies)) ? snap.data().replies.slice() : []
          current.push({
            boss: { email: me.email || '', nickname: myNickname || '老闆' },
            text,
            createdAt: Timestamp.now()
          })
          await updateDoc(ref, { replies: current })
          input.value = ''
          toast('已送出回覆')
          await loadRecent60Days()
        })
        replyWrap.appendChild(form)
        box.appendChild(replyWrap)
      }

      // 最後把這個人的卡片放進當日清單
      body.appendChild(box)
    }

    card.appendChild(head)
    card.appendChild(body)
    reportList.appendChild(card)
  }
}

// 工具
function escapeHtml(s){
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return (s||'').replace(/[&<>"']/g, ch => map[ch]);
}

function toast(msg){
  toastEl.textContent = msg
  toastEl.hidden = false
  setTimeout(()=>{ toastEl.hidden = true }, 1600)
}


// ----- Color Palettes & Emoji Picker (integrated) -----
const COLORS = [
  '#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#efefef','#f3f4f6','#ffffff',
  '#e53935','#d81b60','#8e24aa','#5e35b1','#3949ab','#1e88e5','#039be5','#00acc1','#00897b','#43a047',
  '#7cb342','#c0ca33','#fdd835','#ffb300','#fb8c00','#f4511e','#6d4c41','#757575','#546e7a','#263238',
  '#ffebee','#fce4ec','#f3e5f5','#ede7f6','#e8eaf6','#e3f2fd','#e1f5fe','#e0f7fa','#e0f2f1','#e8f5e9',
  '#f1f8e9','#f9fbe7','#fffde7','#fff8e1','#fff3e0','#fbe9e7','#efebe9','#fafafa','#eceff1','#e0e0e0'
];
const EMOJIS = ['✅','🐇','🌸','⭐','📦','🔥','⏳','🚧','👏','👍','💡','📝','📌','🗂️','🛠️','🎯','⚠️','💬','📈','📆','🕒','💤','🍀','💪','❤️'];

function buildColorPanel(el, onPick){
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'dr-color-grid';
  COLORS.forEach(c=>{
    const b = document.createElement('button');
    b.type='button'; b.className='dr-color-swatch'; b.style.backgroundColor=c; b.title=c;
    b.addEventListener('click', ()=> onPick(c));
    grid.appendChild(b);
  });
  const foot = document.createElement('div'); foot.className='dr-pop-footer';
  foot.innerHTML = `<span>自訂</span><input type="color" class="dr-input-color" value="#000000">`;
  foot.querySelector('input').addEventListener('input', e=> onPick(e.target.value));
  el.appendChild(grid); el.appendChild(foot);
}

function buildEmojiPanel(el, onPick){
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'dr-emoji-grid';
  EMOJIS.forEach(emoji=>{
    const b = document.createElement('button');
    b.type='button'; b.className='dr-emoji'; b.textContent=emoji;
    b.addEventListener('click', ()=> onPick(emoji));
    grid.appendChild(b);
  });
  el.appendChild(grid);
}

function togglePop(pop, anchor){
  const rect = anchor.getBoundingClientRect();
  pop.style.top = window.scrollY + rect.bottom + 8 + 'px';
  pop.style.left = window.scrollX + rect.left + 'px';
  document.querySelectorAll('.dr-pop').forEach(p=> p.classList.remove('show'));
  pop.classList.add('show');
}
function closePops(e){
  const pops = document.querySelectorAll('.dr-pop');
  if ([...pops].some(p=> p.contains(e.target)) ) return;
  if (e.target.closest('.dr-btn')) return;
  pops.forEach(p=> p.classList.remove('show'));
}
document.addEventListener('click', closePops);

window.addEventListener('DOMContentLoaded', ()=>{
  const popColor = document.getElementById('popColor');
  const popBg = document.getElementById('popBg');
  const popEmoji = document.getElementById('popEmoji');
  if (popColor && !popColor.dataset.ready){
    buildColorPanel(popColor, (c)=> { document.execCommand('foreColor', false, c); closePops({target:document.body}); });
    popColor.dataset.ready = '1';
  }
  if (popBg && !popBg.dataset.ready){
    buildColorPanel(popBg, (c)=> { document.execCommand('hiliteColor', false, c); closePops({target:document.body}); });
    popBg.dataset.ready = '1';
  }
  if (popEmoji && !popEmoji.dataset.ready){
    buildEmojiPanel(popEmoji, (e)=> { document.execCommand('insertText', false, e); closePops({target:document.body}); });
    popEmoji.dataset.ready = '1';
  }

  const btnColor = document.getElementById('btnColor');
  const btnBg = document.getElementById('btnBg');
  const btnEmoji = document.getElementById('btnEmoji');
  if (btnColor) btnColor.addEventListener('click', ()=> togglePop(popColor, btnColor));
  if (btnBg) btnBg.addEventListener('click', ()=> togglePop(popBg, btnBg));
  if (btnEmoji) btnEmoji.addEventListener('click', ()=> togglePop(popEmoji, btnEmoji));
});

/* DR_TOOLBAR_DYNAMIC_INJECTOR */
(function(){ 
  function ensureButtons(){ 
    const toolbar = document.querySelector('.dr-toolbar');
    if (!toolbar) return false;
    let btnU = toolbar.querySelector('#btnUnderline');
    if (!btnU) { 
      btnU = Array.from(toolbar.querySelectorAll('button')).find(b=>b.textContent && b.textContent.trim()==='U');
    }
    if (!btnU) return false;
    if (toolbar.querySelector('#btnEmoji')) return true;

    function el(tag, attrs, html){ 
      const e=document.createElement(tag); 
      if (attrs) Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); 
      if (html) e.innerHTML=html; 
      return e; 
    }

    const btnColor = el('button',{id:'btnColor',class:'dr-btn','data-pop':'color'},'字色 ▼');
    const btnBg    = el('button',{id:'btnBg',class:'dr-btn','data-pop':'bg'},'底色 ▼');
    const btnEmoji = el('button',{id:'btnEmoji',class:'dr-btn','data-pop':'emoji'},'😀 Emoji');
    btnU.insertAdjacentElement('afterend', btnColor);
    btnColor.insertAdjacentElement('afterend', btnBg);
    btnBg.insertAdjacentElement('afterend', btnEmoji);

    const anchor = document.querySelector('.dr-editor-card') || document.querySelector('.dr-editor') || document.body;
    const popColor = el('div',{id:'popColor',class:'dr-pop dr-pop-colors'});
    const popBg    = el('div',{id:'popBg',class:'dr-pop dr-pop-colors'});
    const popEmoji = el('div',{id:'popEmoji',class:'dr-pop dr-pop-emoji'});
    anchor.appendChild(popColor); anchor.appendChild(popBg); anchor.appendChild(popEmoji);

    const COLORS=['#000','#434343','#666','#999','#b7b7b7','#ccc','#d9d9d9','#efefef','#f3f4f6','#fff','#e53935','#d81b60','#8e24aa','#5e35b1','#3949ab','#1e88e5','#039be5','#00acc1','#00897b','#43a047','#7cb342','#c0ca33','#fdd835','#ffb300','#fb8c00','#f4511e','#6d4c41','#757575','#546e7a','#263238','#ffebee','#fce4ec','#f3e5f5','#ede7f6','#e8eaf6','#e3f2fd','#e1f5fe','#e0f7fa','#e0f2f1','#e8f5e9','#f1f8e9','#f9fbe7','#fffde7','#fff8e1','#fff3e0','#fbe9e7','#efebe9','#fafafa','#eceff1','#e0e0e0'];
    const EMOJIS=['✅','🐇','🌸','⭐','📦','🔥','⏳','🚧','👏','👍','💡','📝','📌','🗂️','🛠️','🎯','⚠️','💬','📈','📆','🕒','💤','🍀','💪','❤️'];

    function buildColors(el,onPick){ 
      el.innerHTML=''; 
      const g=el.appendChild(document.createElement('div')); 
      g.className='dr-color-grid';
      COLORS.forEach(c=>{ 
        const b=document.createElement('button'); 
        b.type='button'; b.className='dr-color-swatch'; b.style.backgroundColor=c; b.title=c; 
        b.addEventListener('click',()=>onPick(c)); 
        g.appendChild(b); 
      });
      const f=document.createElement('div'); f.className='dr-pop-footer'; 
      f.innerHTML='<span>自訂</span><input type="color" class="dr-input-color" value="#000000">'; 
      f.querySelector('input').addEventListener('input', e=>onPick(e.target.value)); 
      el.appendChild(f); 
    }

    function buildEmojis(el,onPick){ 
      el.innerHTML=''; 
      const g=el.appendChild(document.createElement('div')); 
      g.className='dr-emoji-grid';
      EMOJIS.forEach(m=>{ 
        const b=document.createElement('button'); 
        b.type='button'; b.className='dr-emoji'; b.textContent=m; 
        b.addEventListener('click',()=>onPick(m)); 
        g.appendChild(b); 
      });
    }

    function show(pop,btn){ 
      const r=btn.getBoundingClientRect(); 
      pop.style.top = window.scrollY + r.bottom + 8 + 'px'; 
      pop.style.left = window.scrollX + r.left + 'px';
      document.querySelectorAll('.dr-pop').forEach(p=>p.classList.remove('show')); 
      pop.classList.add('show'); 
    }

    document.addEventListener('click', e=>{ 
      const pops=document.querySelectorAll('.dr-pop'); 
      if ([...pops].some(p=>p.contains(e.target))) return; 
      if (e.target.closest('.dr-btn')) return; 
      pops.forEach(p=>p.classList.remove('show')); 
    });

    buildColors(popColor, c=>{ document.execCommand('foreColor',false,c); popColor.classList.remove('show'); });
    buildColors(popBg, c=>{ document.execCommand('hiliteColor',false,c); popBg.classList.remove('show'); });
    buildEmojis(popEmoji, m=>{ document.execCommand('insertText',false,m); popEmoji.classList.remove('show'); });

    btnColor.addEventListener('click', ()=>show(popColor,btnColor));
    btnBg.addEventListener('click', ()=>show(popBg,btnBg));
    btnEmoji.addEventListener('click', ()=>show(popEmoji,btnEmoji));

    return true;
  }

  function boot(){ 
    let tries=0; 
    const t=setInterval(()=>{ 
      if (ensureButtons() || tries++>25) clearInterval(t); 
    }, 200); 
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();    


// === 每日工作側欄 ===
const dailyFrame = document.getElementById('dailyFrame')
const btnToggleDaily = document.getElementById('btnToggleDaily')
function setDailyFrameSrc(){
  if (!dailyFrame) return
  const ymd = todayYMD()
  dailyFrame.src = `/daily.html?date=${ymd}&embed=1`
}
function adjustDailyHeight(){
  if (!dailyFrame) return
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
  dailyFrame.style.minHeight = (vh - 140) + 'px'
}
if (dailyFrame){
  setDailyFrameSrc()
  adjustDailyHeight()
  window.addEventListener('resize', adjustDailyHeight)
}

;

// v2.14: 移除側欄開關，清除舊設定（若有）
try{ localStorage.removeItem('dr.dailyPane.open'); }catch(e){}
