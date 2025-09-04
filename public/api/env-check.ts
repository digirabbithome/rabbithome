import type { VercelRequest, VercelResponse } from '@vercel/node'
export default function handler(_req: VercelRequest, res: VercelResponse){
  const pk = process.env.FB_PRIVATE_KEY || ''
  res.json({
    hasProjectId: !!process.env.FB_PROJECT_ID,
    hasClientEmail: !!process.env.FB_CLIENT_EMAIL,
    privateKeyLength: pk.length,
    containsEscapedNewlines: pk.includes('\n')
  })
}
