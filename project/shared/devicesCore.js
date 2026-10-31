import { todayStr } from './generators.js'

export const DEVICE_STATUSES = ['online', 'offline', 'maintenance']

export function deviceStatusLabel(status) {
  if (status === 'online') return '在线'
  if (status === 'maintenance') return '维护中'
  if (status === 'offline') return '离线'
  return '未知'
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return h
}

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shiftDate(base, offsetDays) {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getDeviceById(db, id) {
  return (db.devices || []).find((d) => d.id === id) || null
}

export function getDevicesLedger(db, { status = '', model = '' } = {}) {
  let list = db.devices || []
  if (status) {
    list = list.filter((d) => d.status === status)
  }
  if (model) {
    list = list.filter((d) => d.model === model)
  }
  return [...list]
}

export function getDeviceTrend(db, deviceId, days = 7, today = todayStr()) {
  const device = getDeviceById(db, deviceId)
  if (!device) return []
  const base = device.status === 'online' ? device.usageRate || 60 : device.status === 'maintenance' ? 12 : 3
  const trend = []
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDate(today, -i)
    const rand = mulberry32(hashString(`${deviceId}#${date}#trend`))
    const rate = Math.max(0, Math.min(99, Math.round(base + (rand() * 2 - 1) * 14 - (i > 2 ? 4 : 0))))
    const scans = Math.max(0, Math.round((rate / 100) * (device.todayCount || 20) + (rand() * 2 - 1) * 4))
    trend.push({ date, usageRate: rate, scans })
  }
  return trend
}

export function getDeviceExamStats(db, deviceId, today = todayStr()) {
  const exams = (db.exams || []).filter((e) => e.deviceId === deviceId)
  const month = today.slice(0, 7)
  const sorted = [...exams].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const device = getDeviceById(db, deviceId)
  const byType = {}
  exams.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + 1
  })
  return {
    total: exams.length,
    thisMonth: exams.filter((e) => String(e.date).startsWith(month)).length,
    lastDate: sorted.length ? sorted[0].date : '—',
    todayCount: device ? device.todayCount || 0 : 0,
    totalScans: device ? device.totalScans || 0 : 0,
    byType
  }
}

export function buildDeviceDetail(db, deviceId, today = todayStr()) {
  const device = getDeviceById(db, deviceId)
  if (!device) {
    return { ok: false, message: '设备不存在' }
  }
  return {
    ok: true,
    data: {
      device,
      trend: getDeviceTrend(db, deviceId, 7, today),
      stats: getDeviceExamStats(db, deviceId, today)
    }
  }
}

export function setDeviceStatus(db, deviceId, status, today = todayStr()) {
  if (!DEVICE_STATUSES.includes(status)) {
    return { ok: false, message: '设备状态无效' }
  }
  const device = getDeviceById(db, deviceId)
  if (!device) {
    return { ok: false, message: '设备不存在' }
  }
  if (device.status === status) {
    return { ok: false, message: `设备已处于「${deviceStatusLabel(status)}」状态` }
  }
  const devices = (db.devices || []).map((d) =>
    d.id === deviceId ? { ...d, status, statusUpdatedAt: today } : d
  )
  return {
    ok: true,
    device: devices.find((d) => d.id === deviceId),
    db: { ...db, devices }
  }
}

export function getOnlineSummary(db) {
  const devices = db.devices || []
  return {
    total: devices.length,
    online: devices.filter((d) => d.status === 'online').length,
    maintenance: devices.filter((d) => d.status === 'maintenance').length,
    offline: devices.filter((d) => d.status === 'offline').length
  }
}