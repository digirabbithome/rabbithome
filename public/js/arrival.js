// arrival.js — Roman/Arabic full-duplex search + better CJK handling
// Build v9 2025-08-19
import { db } from '/js/firebase.js';
import {
  collection, addDoc, serverTimestamp, query, orderBy, getDocs,
  updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

let allData = [];
let sortField = 'createdAt';
let sortDirection = 'desc';
let currentPage = 1;
const pageSize = 200;

/* ========== 基礎正規化（全形→半形、去重音、壓縮空白） ========== */
function baseNormalize(str = "") {
  return String(str)
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ========== 羅馬數字 <-> 阿拉伯數字 ========== */
const ROMAN_TABLE = [
  ["M",1000],["CM",900],["D",500],["CD",400],
  ["C",100],["XC",90],["L",50],["XL",40],
  ["X",10],["IX",9],["V",5],["IV",4],["I",1]
];
function romanToInt(roman = "") {
  let s = roman.toUpperCase();
  let i = 0, val = 0;
  while (i < s.length) {
    let matched = false;
    for (const [sym, num] of ROMAN_TABLE) {
      if (s.startsWith(sym, i)) { val += num; i += sym.length; matched = true; break; }
    }
    if (!matched) return NaN;
  }
  return val;
}
function intToRoman(n) {
  if (!Number.isInteger(n) || n <= 0 || n > 3999) return "";
  let res = "";
  for (const [sym, num] of ROMAN_TABLE) {
    while (n >= num) { res += sym; n -= num; }
  }
  return res;
}

// 判斷 token 是否為「基底 + 尾碼（羅馬或數字）」
function splitSuffixToken(tok) {
  const mRoman = tok.match(/^([a-z0-9]+?)(i|ii|iii|iv|v|vi|vii|viii|ix|x|xl|l|xc|c|cd|d|cm|m)+$/i);
  if (mRoman) {
    const base = mRoman[1];
    const roman = tok.slice(base.length);
    const n = romanToInt(roman);
    if (!isNaN(n)) return { base, num: String(n), roman: roman.toLowerCase() };
  }
  const mDigit = tok.match(/^([a-z0-9]+?)(\d{1,4})$/i);
  if (mDigit) {
    return { base: mDigit[1], num: mDigit[2], roman: intToRoman(parseInt(mDigit[2], 10)).toLowerCase() };
  }
  return null;
}

/* ========== 型號別名標準化（兼容 RX100 系列、Mark/Mk 變體等） ========== */
function normalizeAlias(str = "") {
  let s = baseNormalize(str);

  // RX100 VII/M7 的常見寫法統一到數字：rx100m7
  s = s.replace(/\brx100\s*(?:mark|mk)?\s*vii\b/gi, "rx100m7")
       .replace(/\brx100\s*mk\s*7\b/gi, "rx100m7")
       .replace(/\brx100\s*m7\b/gi, "rx100m7")
       .replace(/\brx100m7\b/gi, "rx100m7")
       .replace(/\brx100vii\b/gi, "rx100m7");

  // Mark / Mk + 羅馬或數字 → mN（任意前綴）
  s = s.replace(/\b([a-z0-9]+)\s*(?:mark|mk)\s*(x|ix|viii|vii|vi|iv|v|iii|ii|i)\b/gi,
      (_, pre, r) => pre + "m" + romanToInt(r));
  s = s.replace(/\b([a-z0-9]+)\s*(?:mark|mk)\s*([0-9]{1,4})\b/gi,
      (_, pre, d) => pre + "m" + d);

  // 黏在一起的 MKII/MII → m2（任意前綴）
  s = s.replace(/([a-z0-9]+)mkii\b/gi, (_, pre) => pre + "m2")
       .replace(/([a-z0-9]+)mii\b/gi,  (_, pre) => pre + "m2");

  // 尾碼羅馬數字 → 尾碼數字（GRIII→GR3、A7RIV→A7R4…）
  s = s.replace(/\b([a-z0-9]+)(i|ii|iii|iv|v|vi|vii|viii|ix|x|xl|l|xc|c|cd|d|cm|m)\b/gi,
      (_, pre, r) => pre + romanToInt(r));

  return s.replace(/\s+/g, " ").trim();
}

/* ========== 搜尋索引與 token 變體（數字版 + 羅馬版） ========== */
function expandTokenVariants(tok) {
  const out = new Set([tok]);
  const info = splitSuffixToken(tok);
  if (info && info.num && info.roman) {
    out.add(info.base + info.num);
    if (info.roman) out.add(info.base + info.roman);
  }
  return Array.from(out);
}

function tokens(str = "") {
  const cleaned = normalizeAlias(baseNormalize(str));
  const arr = cleaned.split(/[^a-z0-9\u3400-\u9FFF\uF900-\uFAFF\u3000-\u303F]+/gi).filter(Boolean);
  const bag = [];
  for (const t of arr) bag.push(...expandTokenVariants(t));
  return bag;
}

function compact(str = "") {
  const cleaned = normalizeAlias(baseNormalize(str));
  return cleaned.replace(/[^a-z0-9\u3400-\u9FFF\uF900-\uFAFF\u3000-\u303F]/gi, "");
}

function matchRow(query, row, mode = 'OR') {
  const qT = tokens(query);
  const bag = row._tokensSet;
  const cq = compact(query);

  const tokenExactHit = (tok) => bag.has(tok);

  // 前綴比對：長度 >=2 即可 (允許 GR, RX 這類短代號)
  const tokenSafePrefixHit = (tok) => {
    if (tok.length < 2) return false;
    for (const w of bag) { if (w.startsWith(tok)) return true; }
    return false;
  };

  // compact 比對：允許包含與前綴
  const compactContinuousHit = () => {
    const q = cq;
    if (!q || q.length < 2) return false;
    const compacted = (row._searchCompact || "");
    return compacted.includes(q) || compacted.startsWith(q);
  };

  const hit = (tok) => tokenExactHit(tok) || tokenSafePrefixHit(tok);

  if (mode === 'AND') {
    if (compactContinuousHit()) return true;
    return qT.every(hit);
  } else {
    if (compactContinuousHit()) return true;
    return qT.some(hit);
  }
}


/* ========== 小工具 ========== */
function debounce(fn, wait = 500) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function fmtDate(ts) {
  const d = ts?.toDate?.() || null;
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).toString().padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/* ========== 新增 / 載入 ========== */
async function addItem() {
  const product = document.getElementById('product').value.trim();
  const market  = document.getElementById('market').value;
  const account = document.getElementById('account').value.trim();
  const note    = document.getElementById('note').value.trim();
  const user    = localStorage.getItem('nickname') || '匿名';
  if (!product || !market) { alert('商品名稱與賣場必填'); return; }

  await addDoc(collection(db, 'arrival'), {
    product, market, account, note,
    status: '未完成',
    important: false,
    deleted: false,
    createdBy: user,
    createdAt: serverTimestamp()
  });

  document.getElementById('product').value = '';
  document.getElementById('account').value = '';
  document.getElementById('note').value = '';
  await loadData();
}

async function loadData() {
  const qy = query(collection(db, 'arrival'), orderBy('createdAt','desc'));
  const snap = await getDocs(qy);
  allData = snap.docs.map(d => {
    const obj = { id: d.id, ...d.data() };
    obj.deleted = !!obj.deleted;
    const blob = [obj.product, obj.market, obj.account, obj.note].join(' || ');
    obj._searchCompact = compact(blob);
    const ts = tokens(blob);
    obj._tokens = ts;
    obj._tokensSet = new Set(ts);
    return obj;
  });
  renderTable();
}

/* ========== 篩選/排序/分頁 ========== */
function applyFilters(list) {
  const kw = document.getElementById('searchKeyword').value.trim();
  const fMarket = document.getElementById('searchMarket').value;
  const fTime = document.getElementById('timeFilter').value;
  const fStatus = document.getElementById('statusFilter').value;
  const mode = (document.querySelector('input[name="mode"]:checked')?.value) || 'OR';
  const now = new Date();

  return list.filter(d => {
    if (d.deleted) return false;
    if (kw && !matchRow(kw, d, mode)) return false;
    if (fMarket && d.market !== fMarket) return false;
    if (fStatus && d.status !== fStatus) return false;
    if (fTime) {
      const days = parseInt(fTime, 10);
      const created = d.createdAt?.toDate?.();
      if (!created) return false;
      const diffDays = (now - created) / 86400000;
      if (diffDays > days) return false;
    }
    return true;
  });
}

function sortList(list) {
  const sf = sortField; const dir = sortDirection === 'asc' ? 1 : -1;
  return list.slice().sort((a,b) => {
    if (sf === 'createdAt') {
      const da = a.createdAt?.toDate?.() || new Date(0);
      const db = b.createdAt?.toDate?.() || new Date(0);
      return (da - db) * dir;
    }
    const va = (a[sf] ?? '').toString();
    const vb = (b[sf] ?? '').toString();
    return va.localeCompare(vb, 'zh-Hant') * dir;
  });
}

function renderPagination(total) {
  const p = document.getElementById('pagination');
  p.innerHTML = '';
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > pages) currentPage = pages;

  const mk = (label, page, disabled = false, active = false) => {
    const b = document.createElement('button');
    b.textContent = label; b.className = 'page-btn' + (active ? ' active' : '');
    b.disabled = disabled;
    b.addEventListener('click', () => { currentPage = page; renderTable(); });
    return b;
  };
  p.appendChild(mk('«', 1, currentPage === 1));
  p.appendChild(mk('‹', Math.max(1, currentPage - 1), currentPage === 1));
  const win = 5;
  let s = Math.max(1, currentPage - Math.floor(win/2));
  let e = Math.min(pages, s + win - 1);
  s = Math.max(1, e - win + 1);
  for (let i=s;i<=e;i++) p.appendChild(mk(String(i), i, false, i===currentPage));
  p.appendChild(mk('›', Math.min(pages, currentPage + 1), currentPage === pages));
  p.appendChild(mk('»', pages, currentPage === pages));
}

function renderTable() {
  const tbody = document.getElementById('list');
  tbody.innerHTML = '';

  let filtered = applyFilters(allData);
  filtered = sortList(filtered);

  const total = filtered.length;
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = filtered.slice(start, end);

  document.getElementById('resultInfo').textContent =
    `共 ${total} 筆，顯示第 ${start+1}-${Math.min(end,total)} 筆`;

  for (const d of pageRows) {
    const tr = document.createElement('tr');
    if (d.important) tr.classList.add('important');
    tr.innerHTML = `
      <td>
        ${fmtDate(d.createdAt)}
        <button class="pen-btn ${d.important ? 'active' : ''}" data-id="${d.id}" title="標記重要">🖊️</button>
      </td>
      <td class="product">${d.product||''}</td>
      <td>${d.market||''}</td>
      <td>${d.account||''}</td>
      <td><input class="note-input" data-id="${d.id}" value="${(d.note||'').replace(/"/g,'&quot;')}"></td>
      <td>${d.createdBy||''}</td>
      <td>
        <select class="status-select" data-id="${d.id}">
          <option value="未完成" ${d.status==='未完成'?'selected':''}>未完成</option>
          <option value="已完成" ${d.status==='已完成'?'selected':''}>已完成</option>
          <option value="刪除">刪除</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // 備註即時儲存（debounce）
  document.querySelectorAll('.note-input').forEach(el => {
    const handler = debounce(async e => {
      await updateDoc(doc(db, 'arrival', el.dataset.id), { note: e.target.value });
    });
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // 狀態切換（含刪除）
  document.querySelectorAll('.status-select').forEach(el => {
    el.addEventListener('change', async () => {
      const id = el.dataset.id;
      const val = el.value;
      if (val === '刪除') {
        await updateDoc(doc(db, 'arrival', id), { deleted: true });
        const row = allData.find(x => x.id === id);
        if (row) row.deleted = true;
      } else {
        await updateDoc(doc(db, 'arrival', id), { status: val });
        const row = allData.find(x => x.id === id);
        if (row) row.status = val;
      }
      renderTable();
    });
  });

  // 重要（🖊️）即時切換
  document.querySelectorAll('.pen-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const row = allData.find(x => x.id === id);
      const newVal = !row?.important;
      await updateDoc(doc(db, 'arrival', id), { important: newVal });
      if (row) row.important = newVal;
      renderTable();
    });
  });

  renderPagination(total);
}

/* ========== 欄位拖曳（記憶寬度） ========== */
function initResizableHeaders() {
  const ths = Array.from(document.querySelectorAll('thead th.resizable'));
  const colgroup = document.getElementById('colgroup');
  const cols = Array.from(colgroup.querySelectorAll('col'));

  try {
    const saved = JSON.parse(localStorage.getItem('arrival_colwidths') || '[]');
    saved.forEach((w, i) => { if (cols[i] && w) cols[i].style.width = w; });
  } catch {}

  ths.forEach((th, i) => {
    const handle = document.createElement('span');
    handle.className = 'col-resizer';
    th.appendChild(handle);

    let startX = 0;
    let startW = 0;

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const newW = Math.max(60, startW + dx);
      cols[i].style.width = newW + 'px';
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const widths = cols.map(c => c.style.width || '');
      localStorage.setItem('arrival_colwidths', JSON.stringify(widths));
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = parseInt(cols[i].style.width || th.getBoundingClientRect().width, 10);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

/* ========== 綁定 ========== */
function bindSortHeaders() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', (e) => {
      if (e.target.classList.contains('col-resizer')) return;
      const f = th.dataset.sort;
      if (sortField === f) { sortDirection = (sortDirection === 'asc' ? 'desc' : 'asc'); }
      else { sortField = f; sortDirection = 'asc'; }
      document.querySelectorAll('th[data-sort]').forEach(x => x.classList.remove('sort-asc','sort-desc'));
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      renderTable();
    });
  });
}

function bindSearchBar() {
  const auto = debounce(() => { currentPage = 1; renderTable(); }, 500);
  ['searchKeyword','searchMarket','timeFilter','statusFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', auto);
    el.addEventListener('change', auto);
  });
  document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener('change', auto);
  });
}

// iframe 友善
window.onload = () => {
  const addBtn = document.getElementById('btnAdd');
  if (addBtn) addBtn.addEventListener('click', addItem);
  bindSearchBar();
  bindSortHeaders();
  initResizableHeaders();
  loadData();
};
