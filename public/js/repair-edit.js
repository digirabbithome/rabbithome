
import {
  doc, getDoc, updateDoc
import {
  ref, uploadBytes, getDownloadURL

const nickname = localStorage.getItem('nickname') || '不明使用者';

function renderStatusBlock(statusCode, title, noteLabel, placeholder, d) {
  if (statusCode === 1) {
    const user = d.user || '未知使用者';
    const created = d.createdAt?.toDate?.();
  return `
    <div class="status-block" data-status="${statusCode}">
      ${!history
        ? `<button class="status-btn" data-next="${statusCode}">${title}</button>`
        : `<h3>${title}　🐰 ${user}　🕒 ${timeStr}</h3>`}
      <textarea data-note="${statusCode}" placeholder="${placeholder || ''}">${noteVal}</textarea>
    </div>`;
      <div class="status-block" data-status="1">
    `;

  const history = d.history?.[statusCode];
  const noteVal = d.notes?.[statusCode] || '';
  const user = history?.user || '';
  const timeStr = history?.time ? new Date(history.time).toLocaleString() : '';

  return `
    <div class="status-block" data-status="${statusCode}">
      ${!history
        ? `<button class="status-btn" data-next="${statusCode}">${title}</button>`
        : `<h3>${title}　🐰 ${user}　🕒 ${timeStr}</h3>`}
      <textarea data-note="${statusCode}" placeholder="${placeholder || ''}">${noteVal}</textarea>
    </div>`;

function updateStatusInfo(status) {
  const box = document.createElement('div');
  box.id = 'status-info-box';
  let text = '⏳ 目前狀況：';
  switch (status) {
    case 1:  text += '已收到維修尚未寄送廠商'; break;
    case 2:  text += '已收到維修且寄送廠商了'; break;
    case 3:  text += '已送修 且修復完畢'; break;
    case 31: text += '已送修 但無法處理或遭退件'; break;
    case 4:  text += '本維修單已處理完成結案'; break;
    default: text += '尚無狀態資料'; break;
  box.textContent = text;
  document.querySelector('.repair-info')?.insertAdjacentElement('afterend', box);

const statusHTML = (d) => `

window.onload = async () => {
  const params = new URLSearchParams(location.search);
  const repairId = params.get('id');
  if (!repairId) {
    document.getElementById('edit-section').innerHTML = '❌ 無效的維修單號';
    return;

  const docRef = doc(db, 'repairs', repairId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    document.getElementById('edit-section').innerHTML = '❌ 查無此筆資料';
    return;

  const d = snapshot.data();
  let contact = '';
  if (d.customer) contact += d.customer;
  const contactRow = (d.customer || d.line || d.phone || d.address)

  const html = `
    <table class="repair-info">
      <tr>
      </tr>
    </table>
    <div id="final-actions">
      <button data-next="4" class="status-btn">✅ 結案</button>
    </div>


  document.getElementById('edit-section').innerHTML = html;
  updateStatusInfo(d.status);

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.onclick = async () => {
      const next = btn.dataset.next;
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        status: Number(next)
      alert('✅ 狀態已更新！');
      location.reload();

  document.querySelectorAll('img.thumbnail').forEach(img => {
    img.addEventListener("mouseover", () => {
      const rect = img.getBoundingClientRect();
      const preview = document.getElementById("imagePreview");
      preview.style.left = rect.right + 10 + "px";
      preview.style.top = rect.top + "px";
      preview.style.display = "block";
    img.addEventListener("mouseout", () => {
      const preview = document.getElementById("imagePreview");
      preview.style.display = "none";
;

  const showSavedHint = () => {
    let div = document.createElement('div');
    div.textContent = '✅ 已儲存';
    div.style.cssText = 'position:fixed;top:10px;right:20px;background:#4caf50;color:white;padding:6px 12px;border-radius:6px;z-index:9999;font-size:14px;';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);

  document.querySelectorAll('textarea[data-note]').forEach(area => {
    const code = area.dataset.note;
    area.addEventListener('input', () => {
      clearTimeout(debounceTimers[code]);
      debounceTimers[code] = setTimeout(async () => {
        const value = area.value;
        if (d.notes?.[code] !== value) {
          showSavedHint();

  document.getElementById('upload-photo')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const urls = d.photos || [];
    for (const file of files) {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    alert('✅ 照片已上傳！');
    location.reload();
