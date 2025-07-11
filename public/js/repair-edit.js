
import { db, storage } from '/js/firebase.js';
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {
  ref, uploadBytes, getDownloadURL, listAll, deleteObject
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

const params = new URLSearchParams(window.location.search);
const repairID = params.get("id") || "";
const nickname = localStorage.getItem("nickname") || "未知";

async function loadRepair() {
  const refDoc = doc(db, "repairs", repairID);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return alert("查無資料");

  const d = snap.data();
  document.getElementById("repair-id").textContent = d.repairID || "";
  document.getElementById("supplier").textContent = d.supplier || "";
  document.getElementById("contact").textContent = d.contact || "";
  document.getElementById("warranty").textContent = d.warranty || "";
  document.getElementById("product").textContent = d.product || "";
  document.getElementById("description").textContent = d.description || "";

  loadImages();
}

async function loadImages() {
  const container = document.getElementById("imagePreview");
  container.innerHTML = "";
  const imageRef = ref(storage, `repairs/${repairID}`);
  const res = await listAll(imageRef);
  for (const item of res.items) {
    const url = await getDownloadURL(item);
    const box = document.createElement("div");
    box.className = "img-box";
    box.innerHTML = `
      <img src="${url}">
      <button data-path="${item.fullPath}">x</button>
    `;
    container.appendChild(box);
  }

  container.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const path = btn.dataset.path;
      await deleteObject(ref(storage, path));
      loadImages();
    });
  });
}

document.getElementById("imageUpload").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  const imageRef = ref(storage, `repairs/${repairID}`);
  const current = await listAll(imageRef);
  if (current.items.length + files.length > 3) {
    alert("最多僅能上傳 3 張圖片");
    return;
  }

  for (const file of files) {
    const imgRef = ref(storage, `repairs/${repairID}/${Date.now()}-${file.name}`);
    await uploadBytes(imgRef, file);
  }

  loadImages();
});

loadRepair();
