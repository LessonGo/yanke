import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'db.json')

const CONSUMABLES = [
  { id: 'C001', name: 'OCT 光学镜片清洁纸', spec: '无尘级 100 片/盒', unit: '盒', stock: 45, threshold: 10, supplier: '科医光电耗材' },
  { id: 'C002', name: '超声耦合剂', spec: '250ml/瓶', unit: '瓶', stock: 12, threshold: 20, supplier: '华康医疗' },
  { id: 'C003', name: '一次性检查眼罩', spec: '50 只/包', unit: '包', stock: 38, threshold: 50, supplier: '华康医疗' },
  { id: 'C004', name: '热敏打印纸（报告用）', spec: '110mm×20m/卷', unit: '卷', stock: 60, threshold: 15, supplier: '鑫诚办公' },
  { id: 'C005', name: '医用酒精棉片', spec: '100 片/盒', unit: '盒', stock: 85, threshold: 20, supplier: '华康医疗' },
  { id: 'C006', name: '一次性无菌手套', spec: '100 只/盒', unit: '盒', stock: 26, threshold: 30, supplier: '华康医疗' },
  { id: 'C007', name: '复方托吡卡胺散瞳滴眼液', spec: '5ml/瓶', unit: '瓶', stock: 70, threshold: 25, supplier: '康明制药' },
  { id: 'C008', name: '盐酸丙美卡因表麻滴眼液', spec: '5ml/瓶', unit: '瓶', stock: 33, threshold: 25, supplier: '康明制药' },
  { id: 'C009', name: '荧光素钠造影剂', spec: '0.5g/支', unit: '支', stock: 8, threshold: 10, supplier: '康明制药' },
  { id: 'C010', name: 'OCT 设备专用保险丝', spec: 'T2A 250V', unit: '个', stock: 12, threshold: 5, supplier: '科医光电耗材' },
  { id: 'C011', name: '下颌托架纸垫', spec: '200 张/包', unit: '包', stock: 120, threshold: 40, supplier: '鑫诚办公' },
  { id: 'C012', name: '空气净化滤芯', spec: 'HEPA H13', unit: '个', stock: 9, threshold: 6, supplier: '科医光电耗材' },
  { id: 'C013', name: '眼位固定胶带', spec: '5cm×5m/卷', unit: '卷', stock: 40, threshold: 15, supplier: '鑫诚办公' },
  { id: 'C014', name: '设备防尘罩', spec: '通用型 90×70cm', unit: '个', stock: 14, threshold: 8, supplier: '科医光电耗材' }
]

const DEVICE_LEDGER = {
  'OCT-001': { purchaseDate: '2023-03-15', totalScans: 4860 },
  'OCT-002': { purchaseDate: '2023-03-15', totalScans: 3980 },
  'OCT-003': { purchaseDate: '2024-06-20', totalScans: 3120 },
  'OCT-004': { purchaseDate: '2024-06-20', totalScans: 2150 },
  'OCT-005': { purchaseDate: '2024-11-08', totalScans: 1460 },
  'OCT-006': { purchaseDate: '2023-09-12', totalScans: 3340 },
  'OCT-007': { purchaseDate: '2024-11-08', totalScans: 980 },
  'OCT-008': { purchaseDate: '2022-07-01', totalScans: 5420 }
}

const DEVICE_INITIAL = {
  'OCT-001': { status: 'online', todayCount: 42 },
  'OCT-002': { status: 'online', todayCount: 35 },
  'OCT-003': { status: 'online', todayCount: 51 },
  'OCT-004': { status: 'online', todayCount: 29 },
  'OCT-005': { status: 'online', todayCount: 22 },
  'OCT-006': { status: 'online', todayCount: 38 },
  'OCT-007': { status: 'maintenance', todayCount: 0 },
  'OCT-008': { status: 'offline', todayCount: 0 }
}

function warrantyUntil(purchaseDate) {
  const d = new Date(`${purchaseDate}T00:00:00`)
  d.setFullYear(d.getFullYear() + 3)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))

db.devices = db.devices.map((device) => {
  const ledger = DEVICE_LEDGER[device.id] || { purchaseDate: '2024-01-10', totalScans: 1000 }
  const initial = DEVICE_INITIAL[device.id] || { status: 'online', todayCount: 0 }
  const serialNo = `SN-${device.model.replace(/[^A-Za-z0-9]/g, '')}-${ledger.purchaseDate.slice(2, 4)}-${device.id.slice(-3)}`
  return {
    ...device,
    status: initial.status,
    todayCount: initial.todayCount,
    serialNo,
    purchaseDate: ledger.purchaseDate,
    warrantyUntil: warrantyUntil(ledger.purchaseDate),
    totalScans: ledger.totalScans,
    maintainDate: '2026-09-30'
  }
})

db.consumables = CONSUMABLES
db.stockLogs = []
db.reports = db.reports || []

const json = JSON.stringify(db, null, 2) + '\n'
fs.truncateSync(DB_PATH, 0)
fs.writeFileSync(DB_PATH, json, 'utf-8')
if (fs.readFileSync(DB_PATH, 'utf-8') !== json) {
  fs.truncateSync(DB_PATH, 0)
  fs.writeFileSync(DB_PATH, json, 'utf-8')
  console.error('写入校验不一致，已重写一次')
}

const lowStock = db.consumables.filter((c) => c.stock < c.threshold)
console.log(`生成完成：耗材 ${db.consumables.length} 种，设备台账已补齐 ${db.devices.length} 台`)
console.log(`低库存耗材 ${lowStock.length} 种：${lowStock.map((c) => `${c.name}(${c.stock}/${c.threshold}${c.unit})`).join('、')}`)
console.log('设备台账示例：', db.devices[0].id, db.devices[0].serialNo, db.devices[0].purchaseDate, '保修至', db.devices[0].warrantyUntil, '累计', db.devices[0].totalScans, '次')