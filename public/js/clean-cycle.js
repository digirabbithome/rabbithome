// clean-cycle.js — Rabbithome 環境整理（週期管理＋貢獻度統計＋CRUD）
const STORAGE_KEY = 'clean_cycle_tasks_v1';
const HISTORY_KEY = 'clean_cycle_history_v1';
const CONTRIB_KEY = 'clean_cycle_contrib_v1';
const NICK_KEY    = 'clean_cycle_nick';

// ===== 工具 =====
function nowIso(){ return new Date().toISOString(); }
function toDateLabel(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function addDays(iso, d){ const dt=new Date(iso||nowIso()); dt.setDate(dt.getDate()+d); return dt.toISOString(); }
function daysBetween(aIso, bIso){ const A=new Date(aIso), B=new Date(bIso); return Math.floor((B-A)/86400000); }
function clampInt(v, min, max){ v=parseInt(v||0,10); if(isNaN(v)) v=min; return Math.max(min, Math.min(max, v)); }
function cid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }

// ===== 資料層（localStorage，可日後替換為 Firestore） =====
function loadTasks(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return seedDefaults();
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : seedDefaults();
  }catch(e){ console.warn('loadTasks fallback seed', e); return seedDefaults(); }
}
function saveTasks(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  setSavedNow();
}
function setSavedNow(){
  const el = document.getElementById('lastSaved');
  if (el) el.textContent = '已儲存於本機 ' + toDateLabel(nowIso());
}
function pushHistory(rec){
  const arr = JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  arr.push(rec);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}
function pushContrib(name, task){
  if(!name) return;
  const arr = JSON.parse(localStorage.getItem(CONTRIB_KEY)||'[]');
  arr.push({ name, task:task.name, area:task.area, doneAt: nowIso() });
  localStorage.setItem(CONTRIB_KEY, JSON.stringify(arr));
}
function clearContrib(){
  localStorage.removeItem(CONTRIB_KEY);
}

// 初始種子
function seedDefaults(){
  const iso = new Date().toISOString();
  const list = [
    {id: cid(), area:'前場', name:'地板掃拖', days:2, last:iso, note:'收銀區角落容易積塵'},
    {id: cid(), area:'前場', name:'展示櫃除塵', days:3, last:iso, note:''},
    {id: cid(), area:'後場', name:'倉庫走道', days:7, last:iso, note:'貨物堆放勿超線'},
    {id: cid(), area:'衛生', name:'洗手台/馬桶', days:2, last:iso, note:'補衛生紙/洗手乳'},
    {id: cid(), area:'公共', name:'垃圾桶清運', days:1, last:iso, note:'晚班收尾必做'}
  ];
  saveTasks(list);
  return list;
}

// ===== 狀態判定 =====
function getStatus(task){
  const cycle = clampInt(task.days, 1, 3650);
  const dueAt = addDays(task.last || nowIso(), cycle);
  const d = daysBetween(nowIso(), dueAt); // >0 表示尚未到期
  let status = 'ok';
  if (d <= 2 && d > 0) status = 'soon';
  if (d <= 0) status = (d===0) ? 'due' : 'over';
  return { status, daysLeft: d, dueAt };
}

// ===== UI 狀態 =====
let tasks = [];
let currentFilter = 'all';
let editingId = null;
let chart = null;

// ===== 初始化 =====
window.onload = () => {
  // 暱稱
  const nick = localStorage.getItem(NICK_KEY)||'';
  const nickEl = document.getElementById('nickname');
  if (nickEl){ nickEl.value = nick; nickEl.addEventListener('input', ()=> localStorage.setItem(NICK_KEY, nickEl.value.trim())); }

  // 資料
  tasks = loadTasks();
  setSavedNow();

  // 綁定控制列
  document.querySelectorAll('.filters .chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.filters .chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderList();
    });
  });
  document.getElementById('openAdd')?.addEventListener('click', openAddDialog);
  document.getElementById('checkAllDue')?.addEventListener('click', completeAllDue);
  document.getElementById('exportCSV')?.addEventListener('click', exportCSV);
  document.getElementById('resetContrib')?.addEventListener('click', ()=>{
    if(confirm('確定清空同事貢獻度紀錄嗎？（僅本機）')){
      clearContrib();
      renderContribChart();
    }
  });

  // 對話框
  document.getElementById('saveTask')?.addEventListener('click', (ev)=>{
    ev.preventDefault();
    submitTaskDialog();
  });

  renderList();
  renderContribChart();
};

// ===== 渲染列表 =====
function renderList(){
  const container = document.getElementById('list');
  container.innerHTML = '';

  // 表頭
  container.appendChild(rowEl({ head:true }));

  let due=0, over=0, doneToday=0;
  const todayStr = (new Date()).toDateString();

  tasks.forEach(task=>{
    const st = getStatus(task);
    const show = matchFilter(st.status, task);
    if (!show) return;

    if (st.status==='due') due++;
    if (st.status==='over') over++;
    if (new Date(task.last).toDateString() === todayStr) doneToday++;

    container.appendChild(rowEl({ task, st }));
  });

  // 統計
  document.getElementById('totalCount').textContent = tasks.length;
  document.getElementById('dueCount').textContent = due;
  document.getElementById('overCount').textContent = over;
  document.getElementById('doneToday').textContent = doneToday;
}

function matchFilter(status, task){
  if (currentFilter==='all') return true;
  if (currentFilter==='ok')   return status==='ok';
  if (currentFilter==='soon') return status==='soon';
  if (currentFilter==='due')  return status==='due';
  if (currentFilter==='overdue') return status==='over';
  if (currentFilter==='done-today'){
    const todayStr = (new Date()).toDateString();
    return new Date(task.last).toDateString() === todayStr;
  }
  return true;
}

function rowEl({head=false, task=null, st=null}){
  const div = document.createElement('div');
  div.className = 'card';

  const row = document.createElement('div');
  row.className = 'row ' + (head?'head':'');

  if (head){
    row.innerHTML = `
      <div>區域</div>
      <div>項目</div>
      <div>週期(天)</div>
      <div>下次到期</div>
      <div>狀態</div>
      <div>上次完成 / 備註 / 操作</div>
    `;
    div.appendChild(row);
    return div;
  }

  const statusPill = pillHtml(st.status, st.daysLeft);
  row.innerHTML = `
    <div class="area">${escapeHtml(task.area||'—')}</div>
    <div>${escapeHtml(task.name||'—')}</div>
    <div>${clampInt(task.days,1,3650)}</div>
    <div>
      <div>${toDateLabel(st.dueAt)}</div>
      <div class="meta">每 ${clampInt(task.days,1,3650)} 天</div>
    </div>
    <div>${statusPill}</div>
    <div>
      <div class="meta">上次 ${toDateLabel(task.last)}</div>
      <div class="meta">${escapeHtml(task.note||'')}</div>
      <div class="actions">
        <button class="btn small" data-act="done">✅ 完成一次</button>
        <button class="btn ghost small" data-act="edit">✏️ 編輯</button>
        <button class="btn ghost small" data-act="reset">↩️ 重設上次</button>
        <button class="btn ghost small" data-act="del">🗑️ 刪除</button>
      </div>
    </div>
  `;

  row.querySelector('[data-act="done"]').addEventListener('click', ()=> completeOne(task.id));
  row.querySelector('[data-act="edit"]').addEventListener('click', ()=> openEditDialog(task.id));
  row.querySelector('[data-act="reset"]').addEventListener('click', ()=> resetLast(task.id));
  row.querySelector('[data-act="del"]').addEventListener('click', ()=> removeTask(task.id));

  div.appendChild(row);
  return div;
}

function pillHtml(status, daysLeft){
  const label = (
    status==='ok'   ? '安全' :
    status==='soon' ? '即將到期' :
    status==='due'  ? '到期' : '逾期'
  );
  let tip = '';
  if (status==='ok' || status==='soon') tip = `剩 ${daysLeft} 天`;
  else if (status==='due') tip = '今天';
  else tip = `逾期 ${Math.abs(daysLeft)} 天`;
  return `<span class="pill ${status}">${label}</span><div class="meta">${tip}</div>`;
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

// ===== 動作 =====
function completeOne(id){
  const nick = (document.getElementById('nickname')?.value||'').trim();
  const i = tasks.findIndex(t=>t.id===id); if(i<0) return;
  tasks[i].last = nowIso();
  saveTasks(tasks);
  pushHistory({ ...tasks[i], doneBy:nick, doneAt: tasks[i].last, action:'complete' });
  pushContrib(nick, tasks[i]);
  renderList();
  renderContribChart();
}

function resetLast(id){
  const i = tasks.findIndex(t=>t.id===id); if(i<0) return;
  if(!confirm('要把「上次完成」重設為今天現在嗎？')) return;
  tasks[i].last = nowIso();
  saveTasks(tasks);
  renderList();
}

function removeTask(id){
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  if(!confirm(`確定刪除「${t.area}-${t.name}」？`)) return;
  tasks = tasks.filter(x=>x.id!==id);
  saveTasks(tasks);
  renderList();
}

// 一鍵完成到期（含逾期）
function completeAllDue(){
  const nick = (document.getElementById('nickname')?.value||'').trim();
  let changed = 0;
  tasks.forEach(t=>{
    const st = getStatus(t);
    if (st.status==='due' || st.status==='over'){
      t.last = nowIso();
      pushHistory({ ...t, doneBy:nick, doneAt: t.last, action:'bulk-complete' });
      pushContrib(nick, t);
      changed++;
    }
  });
  if (changed>0){
    saveTasks(tasks);
    renderList();
    renderContribChart();
  } else {
    alert('目前沒有到期/逾期項目。');
  }
}

// ===== CRUD 對話框 =====
let editingId = null;
function openAddDialog(){
  editingId = null;
  document.getElementById('dlgTitle').textContent = '新增項目';
  document.getElementById('fArea').value = '';
  document.getElementById('fName').value = '';
  document.getElementById('fDays').value = 7;
  document.getElementById('fLast').value = '';
  document.getElementById('fNote').value = '';
  document.getElementById('taskDlg').showModal();
}
function openEditDialog(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  editingId = id;
  document.getElementById('dlgTitle').textContent = '編輯項目';
  document.getElementById('fArea').value = t.area||'';
  document.getElementById('fName').value = t.name||'';
  document.getElementById('fDays').value = clampInt(t.days,1,3650);
  const dt = new Date(t.last||nowIso());
  const v = dt.toISOString().slice(0,16);
  document.getElementById('fLast').value = v;
  document.getElementById('fNote').value = t.note||'';
  document.getElementById('taskDlg').showModal();
}
function submitTaskDialog(){
  const area = document.getElementById('fArea').value.trim();
  const name = document.getElementById('fName').value.trim();
  const days = clampInt(document.getElementById('fDays').value, 1, 3650);
  const lastInput = document.getElementById('fLast').value;
  const last = lastInput ? new Date(lastInput).toISOString() : nowIso();
  const note = document.getElementById('fNote').value.trim();

  if (!area || !name){ alert('請輸入「區域」與「項目名稱」'); return; }

  if (editingId){
    const i = tasks.findIndex(t=>t.id===editingId); if(i<0) return;
    tasks[i] = { ...tasks[i], area, name, days, last, note };
  }else{
    tasks.push({ id: cid(), area, name, days, last, note });
  }
  saveTasks(tasks);
  document.getElementById('taskDlg').close();
  renderList();
}

// ===== 匯出 CSV =====
function exportCSV(){
  const rows = [
    ['區域','項目','週期(天)','上次完成ISO','備註','下次到期ISO','狀態']
  ];
  tasks.forEach(t=>{
    const st = getStatus(t);
    rows.push([t.area, t.name, t.days, t.last, t.note||'', st.dueAt, st.status]);
  });
  const csv = rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clean-cycle-tasks.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ===== 圖表 =====
let chart = null;
function renderContribChart(){
  const ctx = document.getElementById('contribChart');
  if (!ctx) return;
  const arr = JSON.parse(localStorage.getItem(CONTRIB_KEY)||'[]');
  const counts = {};
  arr.forEach(r => {
    const key = (r.name||'未填暱稱').trim() || '未填暱稱';
    counts[key] = (counts[key]||0) + 1;
  });
  const labels = Object.keys(counts);
  const values = labels.map(k=>counts[k]);
  const sum = values.reduce((a,b)=>a+b,0) || 1;
  const percents = values.map(v=>Math.round(v/sum*1000)/10);

  if (chart){ chart.destroy(); }
  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: '完成次數占比(%)', data: percents, borderWidth: 1 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: { label: (c)=> `${c.raw}%（${values[c.dataIndex]} 次）` } }
      },
      scales: { x: { min:0, max:100, ticks:{ callback:(v)=> v+'%' } } }
    }
  });
}
