// /js/workreport-util.js
// 數位小兔 Rabbithome 共用工具：寫入工作回報
// v2025-10-05

import { db, auth } from '/js/firebase.js'
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const COL_WORKREPORTS = 'workReports'

function todayYMD_TPE(){
  const now = new Date()
  const tpe = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const y = tpe.getFullYear()
  const m = String(tpe.getMonth()+1).padStart(2,'0')
  const d = String(tpe.getDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}

function nowHM_TPE(){
  const now = new Date()
  const tpe = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const h = String(tpe.getHours()).padStart(2,'0')
  const n = String(tpe.getMinutes()).padStart(2,'0')
  return `${h}:${n}`
}

/**
 * 寫一行到 workReports（若當天已有檔，會自動 append 到最後）
 * @param {string} lineText - 例如 "完成 9:30 阿寶交代"
 */
export function appendWorkReportLine(lineText){
  return new Promise((resolve, reject)=>{
    onAuthStateChanged(auth, async (user)=>{
      if (!user) return reject(new Error('未登入，無法寫入工作回報'))
      try{
        const uid = user.uid || 'unknown'
        const email = user.email || ''
        const nickname = (localStorage.getItem('nickname') || (email.split('@')[0] || '未填暱稱')).trim()

        const dateStr = todayYMD_TPE()
        const monthKey = dateStr.slice(0,7)
        const timeStr = nowHM_TPE()
        const id = `${uid}_${dateStr}`

        const ref = doc(db, COL_WORKREPORTS, id)
        const snap = await getDoc(ref)
        const line = `${timeStr} ${lineText}`
        const lineHtml = `<div>${line}</div>`

        if (snap.exists()){
          const d = snap.data() || {}
          await updateDoc(ref, {
            plainText: (d.plainText ? d.plainText + '\n' : '') + line,
            contentHtml: (d.contentHtml ? d.contentHtml + lineHtml : lineHtml),
            updatedAt: serverTimestamp()
          })
        }else{
          await setDoc(ref, {
            author: { email, nickname },
            date: dateStr,
            monthKey,
            plainText: line,
            contentHtml: lineHtml,
            createdAt: serverTimestamp()
          })
        }
        resolve(true)
      }catch(err){
        console.error('[workReports] append failed', err)
        reject(err)
      }
    })
  })
}

/**
 * 結構化寫法：將 action/topic/detail 組成一句話再寫入
 * @param {object} opt
 * @param {string} opt.action  - 例如 "完成" / "寄出"
 * @param {string} opt.topic   - 例如 "對帳" / "出貨"
 * @param {string} [opt.detail]- 額外說明，例如 "供應商 永裕"
 */
export async function appendWorkReport({ action, topic, detail = '' }){
  const text = detail ? `${action} ${topic}｜${detail}` : `${action} ${topic}`
  return appendWorkReportLine(text)
}
