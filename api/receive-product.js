
import { db } from '../../js/firebase-external.js'
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' })
  }

  try {
    const product = req.body

    if (!product.name || !product.price) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name or price' })
    }

    const docRef = await addDoc(collection(db, 'pos-temp-products'), {
      ...product,
      createdAt: serverTimestamp(),
    })

    return res.status(200).json({ success: true, id: docRef.id })
  } catch (error) {
    console.error('🔥 Error:', error)
    return res.status(500).json({ success: false, message: 'Server error', error: error.message })
  }
}
