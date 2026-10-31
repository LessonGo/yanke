import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEVICE_TYPE } from './examContent.js'
import { TIME_SLOTS } from './reservationsCore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'db.json')

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20261028)

function dateStr(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
const onlineDevices = db.devices.filter((d) => d.status === 'online')
const patients = db.patients

const used = new Set()
function pickSlot(deviceId, date) {
  for (let i = 0; i < 40; i++) {
    const slot = TIME_SLOTS[Math.floor(rand() * TIME_SLOTS.length)]
    const key = `${deviceId}|${date}|${slot}`
    if (!used.has(key)) {
      used.add(key)
      return slot
    }
  }
  return null
}

const reservations = []
let seq = 1

function addReservation(dayOffset, patientIdx, status) {
  const device = onlineDevices[Math.floor(rand() * onlineDevices.length)]
  const patient = patients[patientIdx % patients.length]
  const date = dateStr(dayOffset)
  const slot = pickSlot(device.id, date)
  if (!slot) return
  reservations.push({
    id: `R${String(seq).padStart(3, '0')}`,
    patientId: patient.id,
    patientName: patient.name,
    examType: DEVICE_TYPE[device.id],
    deviceId: device.id,
    deviceName: device.name,
    date,
    slot,
    status,
    createdAt: dateStr(0)
  })
  seq++
}

const todayPatients = [3, 10, 17, 24, 31, 6, 38]
todayPatients.forEach((idx, i) => {
  addReservation(0, idx, i === 5 ? '已取消' : '待检查')
})

const tomorrowPatients = [1, 8, 15, 22, 29, 12, 5, 33, 19, 27]
tomorrowPatients.slice(0, 5).forEach((idx) => {
  addReservation(1, idx, '待检查')
})

const dayAfterPatients = [2, 9, 16, 23, 30]
dayAfterPatients.forEach((idx) => {
  addReservation(2, idx, '待检查')
})

db.reservations = reservations
const json = JSON.stringify(db, null, 2) + '\n'
fs.truncateSync(DB_PATH, 0)
fs.writeFileSync(DB_PATH, json, 'utf-8')
if (fs.readFileSync(DB_PATH, 'utf-8') !== json) {
  fs.truncateSync(DB_PATH, 0)
  fs.writeFileSync(DB_PATH, json, 'utf-8')
  console.error('写入校验不一致，已重写一次')
}

const byStatus = {}
reservations.forEach((r) => (byStatus[r.status] = (byStatus[r.status] || 0) + 1))
console.log(`生成完成：预约 ${reservations.length} 条`)
console.log(`状态分布：${Object.entries(byStatus).map(([k, v]) => `${k}×${v}`).join('、')}`)
console.log(`日期分布：今日×${reservations.filter((r) => r.date === dateStr(0)).length}、明日×${reservations.filter((r) => r.date === dateStr(1)).length}、后日×${reservations.filter((r) => r.date === dateStr(2)).length}`)
const conflict = reservations.filter(
  (a) =>
    a.status !== '已取消' &&
    reservations.some((b) => b !== a && b.deviceId === a.deviceId && b.date === a.date && b.slot === a.slot && b.status !== '已取消')
)
console.log(`设备同时段冲突检查：${conflict.length} 处（应为 0）`)