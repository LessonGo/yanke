import { todayStr } from './generators.js'
import { DEVICE_TYPE, DOCTORS, PLATFORM_PROFILES, devicePlatform, aiResultFor, conclusionFor } from './examContent.js'

export const TIME_SLOTS = (() => {
  const slots = []
  let h = 8
  let m = 30
  while (h < 17) {
    const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const endMin = m + 30
    const endH = endMin === 60 ? h + 1 : h
    const endM = endMin === 60 ? 0 : endMin
    const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
    slots.push(`${start}-${end}`)
    m = endM
    h = endH
  }
  return slots
})()

export function getReservations(db, { status = '', date = '' } = {}) {
  let list = db.reservations || []
  if (status) {
    list = list.filter((r) => r.status === status)
  }
  if (date) {
    list = list.filter((r) => r.date === date)
  }
  return [...list].sort((a, b) => {
    const byDate = String(a.date).localeCompare(String(b.date))
    if (byDate !== 0) return byDate
    return String(a.slot).localeCompare(String(b.slot))
  })
}

function nextReservationId(db) {
  const list = db.reservations || []
  let max = 0
  list.forEach((r) => {
    const n = parseInt(String(r.id || '').replace(/\D/g, ''), 10)
    if (Number.isFinite(n) && n > max) max = n
  })
  return `R${max + 1}`
}

export function createReservation(db, { patientId, deviceId, date, slot } = {}) {
  if (!patientId || !deviceId || !date || !slot) {
    return { ok: false, message: '请完整填写患者、设备、日期与时段' }
  }
  const patient = (db.patients || []).find((p) => p.id === patientId)
  if (!patient) {
    return { ok: false, message: '患者不存在' }
  }
  const device = (db.devices || []).find((d) => d.id === deviceId)
  if (!device) {
    return { ok: false, message: '设备不存在' }
  }
  if (device.status !== 'online') {
    return { ok: false, message: `设备 ${device.id} 当前${device.status === 'maintenance' ? '维护中' : '离线'}，不可预约` }
  }
  if (!DEVICE_TYPE[deviceId]) {
    return { ok: false, message: '设备不支持 OCT 检查' }
  }
  if (String(date) < todayStr()) {
    return { ok: false, message: '预约日期不能早于今日' }
  }
  if (!TIME_SLOTS.includes(slot)) {
    return { ok: false, message: '预约时段无效' }
  }
  const conflict = (db.reservations || []).some(
    (r) =>
      r.deviceId === deviceId &&
      r.date === date &&
      r.slot === slot &&
      r.status !== '已取消'
  )
  if (conflict) {
    return { ok: false, message: `设备 ${deviceId} 在 ${date} ${slot} 已有预约，请更换设备或时段` }
  }
  const reservation = {
    id: nextReservationId(db),
    patientId,
    patientName: patient.name,
    examType: DEVICE_TYPE[deviceId],
    deviceId,
    deviceName: device.name,
    date: String(date),
    slot,
    status: '待检查',
    createdAt: todayStr()
  }
  return {
    ok: true,
    reservation,
    db: { ...db, reservations: [...(db.reservations || []), reservation] }
  }
}

export function startReservation(db, id) {
  const reservation = (db.reservations || []).find((r) => r.id === id)
  if (!reservation) {
    return { ok: false, message: '预约不存在' }
  }
  if (reservation.status !== '待检查') {
    return { ok: false, message: `预约状态为「${reservation.status}」，仅待检查状态可发起检查` }
  }
  const patient = (db.patients || []).find((p) => p.id === reservation.patientId)
  if (!patient) {
    return { ok: false, message: '患者数据异常' }
  }
  const platform = devicePlatform(reservation.deviceId) || 'SD-OCT'
  return {
    ok: true,
    data: {
      reservation,
      patient: { id: patient.id, name: patient.name, gender: patient.gender, age: patient.age, tags: patient.tags || [] },
      device: { id: reservation.deviceId, name: reservation.deviceName, type: reservation.examType },
      platform,
      profile: PLATFORM_PROFILES[platform]
    }
  }
}

function nextExamSeq(db) {
  return (db.exams || []).length + 1
}

export function completeReservation(db, id) {
  const list = db.reservations || []
  const index = list.findIndex((r) => r.id === id)
  if (index === -1) {
    return { ok: false, message: '预约不存在' }
  }
  const reservation = list[index]
  if (reservation.status !== '待检查') {
    return { ok: false, message: `预约状态为「${reservation.status}」，仅待检查状态可完成检查` }
  }
  const patient = (db.patients || []).find((p) => p.id === reservation.patientId)
  if (!patient) {
    return { ok: false, message: '患者数据异常' }
  }

  const today = todayStr()
  const seq = nextExamSeq(db)
  const exam = {
    id: `E${today.replace(/-/g, '')}${String(seq).padStart(4, '0')}`,
    patientId: patient.id,
    date: today,
    deviceId: reservation.deviceId,
    deviceName: reservation.deviceId,
    type: reservation.examType,
    aiResult: aiResultFor(patient.tags),
    conclusion: conclusionFor(patient.tags, true),
    doctor: DOCTORS[seq % DOCTORS.length],
    reportReady: true
  }

  const reservations = list.map((r) => (r.id === id ? { ...r, status: '已完成' } : r))
  const patients = (db.patients || []).map((p) =>
    p.id === patient.id
      ? { ...p, lastExamDate: today, examCount: (p.examCount || 0) + 1 }
      : p
  )
  const devices = (db.devices || []).map((d) =>
    d.id === reservation.deviceId ? { ...d, todayCount: (d.todayCount || 0) + 1 } : d
  )

  return {
    ok: true,
    data: {
      examId: exam.id,
      patientId: patient.id,
      patientName: patient.name,
      aiResult: exam.aiResult,
      conclusion: exam.conclusion,
      doctor: exam.doctor
    },
    db: { ...db, reservations, patients, devices, exams: [...(db.exams || []), exam] }
  }
}

export function cancelReservation(db, id) {
  const list = db.reservations || []
  const index = list.findIndex((r) => r.id === id)
  if (index === -1) {
    return { ok: false, message: '预约不存在' }
  }
  const reservation = list[index]
  if (reservation.status !== '待检查') {
    return { ok: false, message: `预约状态为「${reservation.status}」，仅待检查状态可取消` }
  }
  const reservations = list.map((r) => (r.id === id ? { ...r, status: '已取消' } : r))
  return { ok: true, db: { ...db, reservations } }
}