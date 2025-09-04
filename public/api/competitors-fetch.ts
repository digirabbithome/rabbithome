import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as admin from 'firebase-admin'
import * as cheerio from 'cheerio'

if (!admin.apps.length){
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: (process.env.FB_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    } as any),
  })
}
const fs = admin.firestore()

const TPE = 'Asia/Taipei'
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TPE })
const todayTPE = () => fmt.format(new Date())

export default async function handler(req: VercelRequest, res: VercelResponse){
  try{
    // 簡化示範：只確認 Firestore 可用
    const testRef = fs.collection('competitors_test').doc('lastRun')
    await testRef.set({ at: new Date().toISOString() }, { merge: true })
    res.status(200).json({ ok:true, date: todayTPE() })
  }catch(err:any){
    console.error(err)
    res.status(500).json({ ok:false, error:String(err?.message||err) })
  }
}
