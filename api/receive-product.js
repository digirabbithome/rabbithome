import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { serviceAccount } from '../js/firebase-admin-config.js'

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) })
}
const db = getFirestore()

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' })
  }

  try {
    const product = req.body
    if (!product.name || !product.price) {
      return res.status(400).json({ success: false, message: 'Missing required fields' })
    }

    const docRef = await db.collection('pos-temp-products').add({
      ...product,
      createdAt: new Date()
    })

    res.status(200).json({ success: true, id: docRef.id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error', error: err.message })
  }
}
