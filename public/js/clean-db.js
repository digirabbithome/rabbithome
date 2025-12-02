import { db } from '/js/firebase.js'
import {collection,getDocs,deleteDoc,doc} 
from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $=s=>document.querySelector(s)
const log=a=>{$('#log-area').innerHTML+=a+"<br>"}

async function calc(){
  log("calc start")
  const snap=await getDocs(collection(db,'bulletins'))
  $('#result-bulletins').textContent = snap.size
}
async function clean(){
  log("clean start")
}
window.onload=()=>{
 $('#btn-calc-bulletins').onclick=calc
 $('#btn-clean-bulletins').onclick=clean
 $('#clear-log').onclick=()=>$('#log-area').innerHTML=""
}
