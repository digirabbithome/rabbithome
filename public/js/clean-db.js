// === Rabbithome 公布欄清理工具 clean-db.js v2 ===
import { db } from '/js/firebase.js'
import { collection, getDocs, deleteDoc, doc } 
  from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const BULLETIN_COLLECTION = 'bulletins'
const CLEAN_DAYS = 21

const $ = (s) => document.querySelector(s)
const logArea = () => $('#log-area')

function appendLog(msg,type='info'){
  const area = logArea()
  if(!area) return
  const line=document.createElement('div')
  line.className=`log-line ${type}`
  const ts=new Date().toLocaleTimeString('zh-TW',{hour12:false})
  line.textContent=`[${ts}] ${msg}`
  area.appendChild(line)
  area.scrollTop=area.scrollHeight
}

function cutoffDate(){
  const d=new Date()
  d.setHours(0,0,0,0)
  d.setDate(d.getDate()-CLEAN_DAYS)
  return d
}

function isDeletable(data,cutoff){
  const mark=data.markState||'none'
  const created=data.createdAt?.toDate?.()
  const hidden=mark==='hidden'
  const old=created instanceof Date && created<cutoff
  return hidden||old
}

async function calculate(){
  const result=$('#result-bulletins')
  const cutoff=cutoffDate()
  appendLog(`計算中：hidden 或 createdAt < ${cutoff.toISOString()}`)

  result.textContent='計算中…'

  try{
    const snap=await getDocs(collection(db,BULLETIN_COLLECTION))
    const total=snap.size
    let deletable=0

    snap.forEach(d=>{
      if(isDeletable(d.data(),cutoff)) deletable++
    })

    result.textContent=`${deletable} / ${total}`
    appendLog(`計算完成：可刪 ${deletable} / 總筆數 ${total}`,'success')
  }catch(e){
    result.textContent='計算失敗'
    appendLog(`錯誤：${e.message}`,'error')
  }
}

async function clean(){
  const ok=confirm("將刪除 hidden 或超過 21 天的公告，無法復原，確定？")
  if(!ok) return

  const cutoff=cutoffDate()
  const result=$('#result-bulletins')
  result.textContent='清理中…'
  appendLog('開始清理公布欄舊資料…')

  try{
    const snap=await getDocs(collection(db,BULLETIN_COLLECTION))
    const total=snap.size
    let deleted=0

    for(const d of snap.docs){
      if(isDeletable(d.data(),cutoff)){
        await deleteDoc(doc(db,BULLETIN_COLLECTION,d.id))
        deleted++
      }
    }

    result.textContent=`已刪除 ${deleted} / 原總數 ${total}`
    appendLog(`清理完成：刪除 ${deleted} 筆`,'success')
  }catch(e){
    result.textContent='清理失敗'
    appendLog(`錯誤：${e.message}`,'error')
  }
}

window.onload=()=>{
  $('#btn-calc-bulletins')?.addEventListener('click',calculate)
  $('#btn-clean-bulletins')?.addEventListener('click',clean)
  $('#clear-log')?.addEventListener('click',()=> logArea().innerHTML="")
  appendLog('公布欄清理工具已載入，請先按「計算」。')
}
