import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as admin from 'firebase-admin'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const ref = fs.collection('test_ping').doc('ping')
    await ref.set({ ok: true, time: new Date().toISOString() }, { merge: true })
    res.status(200).json({ ok: true })
  } catch (e:any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
