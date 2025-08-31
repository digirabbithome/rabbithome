import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as admin from 'firebase-admin'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

if (!admin.apps.length){
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: (process.env.FB_PRIVATE_KEY || '').replace(/\n/g, '\n'),
    } as any),
  })
}
const fs = admin.firestore()

const TPE = 'Asia/Taipei'
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TPE })
const todayTPE = () => fmt.format(new Date())

const SOURCES: Array<{ key:string; name:string; type:'ruten'|'shopee'; url?:string; username?:string }>= [
  { key:'ruten_cam',    name:'露天 camerapro', type:'ruten',  url:'https://www.ruten.com.tw/store/camerapro' },
  { key:'shopee_cam',   name:'蝦皮 camerapro', type:'shopee', username:'camerapro' },
  { key:'ruten_uandai', name:'露天 uandai',    type:'ruten',  url:'https://www.ruten.com.tw/store/uandai' },
  { key:'shopee_digino',name:'蝦皮 digino1',  type:'shopee', username:'digino1' },
]

export default async function handler(req: VercelRequest, res: VercelResponse){
  try{
    const date = todayTPE()
    const prevDoc = await fs.collection('competitors_daily').doc(date).get()
    const prevItems = prevDoc.exists ? (prevDoc.data()?.items || []) : []
    const prevIndex = new Map<string, any>()
    for (const it of prevItems){ prevIndex.set(itemKey(it), it) }

    const allItems: any[] = []
    for (const s of SOURCES){
      try{
        let list: any[] = []
        if (s.type === 'shopee' && s.username){
          list = await fetchShopeeByUsername(s.username, s.name)
        } else if (s.type === 'ruten' && s.url){
          list = await fetchRutenStore(s.url, s.name)
        }
        allItems.push(...list)
      }catch(err){ console.error('source failed:', s, err) }
    }

    let totalDelta = 0
    for (const it of allItems){
      const old = prevIndex.get(itemKey(it))
      const delta = Math.max(0, (it.sold||0) - (old?.sold||0))
      it.delta = Number.isFinite(delta) ? delta : 0
      totalDelta += it.delta
    }

    const top = allItems.slice().sort((a,b)=> (b.delta||0)-(a.delta||0)).slice(0,50)

    const docData = {
      date,
      summary: { date, sources: SOURCES.length, totalItems: allItems.length, totalDelta },
      items: allItems,
      top,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    await fs.collection('competitors_daily').doc(date).set(docData, { merge:true })
    await fs.collection('competitors_runs').add({ date, count: allItems.length, createdAt: admin.firestore.FieldValue.serverTimestamp() })

    res.status(200).json({ ok:true, date })
  }catch(err:any){
    console.error(err)
    res.status(500).json({ ok:false, error:String(err?.message||err) })
  }
}

async function fetchShopeeByUsername(username:string, sourceName:string){
  const headers = { 'user-agent':'Mozilla/5.0' }
  const infoUrl = `https://shopee.tw/api/v4/shop/get_shop_detail?username=${encodeURIComponent(username)}`
  const info = await (await fetch(infoUrl, { headers })).json() as any
  const shopid = info?.data?.shopid
  if (!shopid) return []
  const limit = 100
  const listUrl = `https://shopee.tw/api/v4/shop/search_items?match_id=${shopid}&limit=${limit}&offset=0&order=desc&sort_by=pop`
  const data = await (await fetch(listUrl, { headers })).json() as any
  const items = (data?.items || []).map((x:any)=>{
    const it = x.item_basic || x
    const title = it.name
    const price = normalizeShopeePrice(it.price)
    const sold  = (it.historical_sold ?? it.sold ?? 0) as number
    const url   = `https://shopee.tw/${slugify(title)}-i.${shopid}.${it.itemid}`
    return { source: sourceName, title, url, price, sold }
  })
  return dedupe(items)
}

function normalizeShopeePrice(raw:any){
  if (raw==null) return undefined
  const n = Number(raw); if (!Number.isFinite(n)) return undefined
  return Math.round(n/100000)
}
function slugify(s:string){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') }

async function fetchRutenStore(storeUrl:string, sourceName:string){
  const html = await (await fetch(storeUrl, { headers:{ 'user-agent':'Mozilla/5.0' }})).text()
  const $ = cheerio.load(html)
  const items:any[] = []
  $('a').each((_, a) => {
    const href = $(a).attr('href') || ''
    const title = $(a).text().trim()
    if (!href || !title) return
    if (!/ruten\.com\.tw\/item\//.test(href) && !/ruten\.com\.tw\/goods\//.test(href)) return
    const url = href.startsWith('http') ? href : new URL(href, storeUrl).toString()
    const card = $(a).closest('div').text()
    const price = pickNumber(card) ?? pickNumber(title)
    const sold  = pickSold(card)
    items.push({ source: sourceName, title, url, price, sold })
  })
  return dedupe(items)
}

function dedupe(list:any[]){
  const seen = new Set<string>(), out:any[] = []
  for (const it of list){ const k=itemKey(it); if(seen.has(k)) continue; seen.add(k); out.push(it) }
  return out
}
function itemKey(it:any){ return `${it.url||''}#${it.title||''}` }
function pickNumber(t:string){ const m=(t||'').replace(/[\,\s]/g,'').match(/\$?(\d{3,8})/); return m?Number(m[1]):undefined }
function pickSold(t:string){ const m=(t||'').match(/(已售|下標|銷售)[^\d]{0,5}(\d{1,5})/); return m?Number(m[2]):0 }
