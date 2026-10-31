import { describe, it, expect } from 'vitest'
import {
  TIME_SLOTS,
  getReservations,
  createReservation,
  startReservation,
  completeReservation,
  cancelReservation
} from '../../shared/reservationsCore.js'
import { getPatientExams } from '../../shared/patientsQuery.js'
import { todayStr } from '../../shared/generators.js'

function makeDb() {
  return {
    patients: [
      { id: 'P1', name: '张建国', tags: ['青光眼'], lastExamDate: '2026-09-01', examCount: 2 },
      { id: 'P2', name: '李淑芬', tags: [], lastExamDate: '2026-09-05', examCount: 1 }
    ],
    devices: [
      { id: 'OCT-001', name: 'SD-OCT 眼部扫描仪 01', status: 'online', todayCount: 5 },
      { id: 'OCT-003', name: 'SS-OCT 深度成像仪 01', status: 'online', todayCount: 3 },
      { id: 'OCT-007', name: 'SD-OCT 眼部扫描仪 04', status: 'maintenance', todayCount: 0 },
      { id: 'OCT-008', name: 'SD-OCT 眼部扫描仪 05', status: 'offline', todayCount: 0 }
    ],
    reservations: [],
    exams: [{ id: 'E202610010001', patientId: 'P1', date: '2026-09-01' }]
  }
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('TIME_SLOTS 时段表', () => {
  it('从 08:30 到 17:00 每 30 分钟一段', () => {
    expect(TIME_SLOTS[0]).toBe('08:30-09:00')
    expect(TIME_SLOTS[TIME_SLOTS.length - 1]).toBe('16:30-17:00')
    expect(TIME_SLOTS).toContain('12:00-12:30')
    expect(TIME_SLOTS.length).toBe(17)
  })
})

describe('getReservations 查询', () => {
  it('按状态与日期筛选，日期升序 + 时段升序', () => {
    const db = makeDb()
    db.reservations = [
      { id: 'R1', date: tomorrowStr(), slot: '10:00-10:30', status: '待检查', deviceId: 'OCT-001', patientId: 'P1', patientName: '张建国' },
      { id: 'R2', date: todayStr(), slot: '14:00-14:30', status: '待检查', deviceId: 'OCT-003', patientId: 'P2', patientName: '李淑芬' },
      { id: 'R3', date: todayStr(), slot: '09:00-09:30', status: '已取消', deviceId: 'OCT-001', patientId: 'P2', patientName: '李淑芬' }
    ]
    const all = getReservations(db)
    expect(all.map((r) => r.id)).toEqual(['R3', 'R2', 'R1'])
    const pending = getReservations(db, { status: '待检查' })
    expect(pending.map((r) => r.id)).toEqual(['R2', 'R1'])
    const today = getReservations(db, { date: todayStr() })
    expect(today.map((r) => r.id)).toEqual(['R3', 'R2'])
  })
})

describe('createReservation 新建预约校验', () => {
  it('成功创建：字段完整、类型按设备推导、状态待检查', () => {
    const db = makeDb()
    const result = createReservation(db, {
      patientId: 'P1',
      deviceId: 'OCT-001',
      date: tomorrowStr(),
      slot: '09:00-09:30'
    })
    expect(result.ok).toBe(true)
    expect(result.reservation.patientName).toBe('张建国')
    expect(result.reservation.examType).toBe('SD-OCT 眼底断层扫描')
    expect(result.reservation.status).toBe('待检查')
    expect(result.db.reservations).toHaveLength(1)
  })

  it('患者不存在 / 设备不存在被拒绝', () => {
    const db = makeDb()
    expect(createReservation(db, { patientId: 'X', deviceId: 'OCT-001', date: tomorrowStr(), slot: '09:00-09:30' }).ok).toBe(false)
    expect(createReservation(db, { patientId: 'P1', deviceId: 'OCT-999', date: tomorrowStr(), slot: '09:00-09:30' }).ok).toBe(false)
  })

  it('维护中 / 离线设备不可预约', () => {
    const db = makeDb()
    const r1 = createReservation(db, { patientId: 'P1', deviceId: 'OCT-007', date: tomorrowStr(), slot: '09:00-09:30' })
    expect(r1.ok).toBe(false)
    expect(r1.message).toContain('维护中')
    const r2 = createReservation(db, { patientId: 'P1', deviceId: 'OCT-008', date: tomorrowStr(), slot: '09:00-09:30' })
    expect(r2.ok).toBe(false)
    expect(r2.message).toContain('离线')
  })

  it('过去日期与非法时段被拒绝', () => {
    const db = makeDb()
    const past = createReservation(db, { patientId: 'P1', deviceId: 'OCT-001', date: yesterdayStr(), slot: '09:00-09:30' })
    expect(past.ok).toBe(false)
    expect(past.message).toContain('不能早于今日')
    const badSlot = createReservation(db, { patientId: 'P1', deviceId: 'OCT-001', date: tomorrowStr(), slot: '25:00-26:00' })
    expect(badSlot.ok).toBe(false)
    expect(badSlot.message).toContain('时段无效')
  })

  it('同设备同日期同时段冲突被拦截；已取消预约不占位', () => {
    const db = makeDb()
    const first = createReservation(db, { patientId: 'P1', deviceId: 'OCT-001', date: tomorrowStr(), slot: '09:00-09:30' })
    expect(first.ok).toBe(true)
    const dbWithFirst = first.db
    const conflict = createReservation(dbWithFirst, { patientId: 'P2', deviceId: 'OCT-001', date: tomorrowStr(), slot: '09:00-09:30' })
    expect(conflict.ok).toBe(false)
    expect(conflict.message).toContain('已有预约')
    const otherSlot = createReservation(dbWithFirst, { patientId: 'P2', deviceId: 'OCT-001', date: tomorrowStr(), slot: '10:00-10:30' })
    expect(otherSlot.ok).toBe(true)

    const canceled = cancelReservation(dbWithFirst, first.reservation.id)
    expect(canceled.ok).toBe(true)
    const reCreate = createReservation(canceled.db, { patientId: 'P2', deviceId: 'OCT-001', date: tomorrowStr(), slot: '09:00-09:30' })
    expect(reCreate.ok).toBe(true)
  })
})

describe('startReservation 发起检查', () => {
  it('返回患者/设备/平台与参数面板配置', () => {
    const db = makeDb()
    const created = createReservation(db, { patientId: 'P1', deviceId: 'OCT-003', date: tomorrowStr(), slot: '09:00-09:30' })
    const started = startReservation(created.db, created.reservation.id)
    expect(started.ok).toBe(true)
    expect(started.data.patient.name).toBe('张建国')
    expect(started.data.platform).toBe('SS-OCT')
    expect(started.data.profile.scanSpeed).toBe('100 万次/秒')
    expect(started.data.profile.imagingDepth).toBe('20 mm')
  })

  it('已完成/已取消/不存在的预约不可发起', () => {
    const db = makeDb()
    const created = createReservation(db, { patientId: 'P1', deviceId: 'OCT-001', date: tomorrowStr(), slot: '09:00-09:30' })
    const completed = completeReservation(created.db, created.reservation.id)
    expect(startReservation(completed.db, created.reservation.id).ok).toBe(false)
    expect(startReservation(db, 'R999').ok).toBe(false)
  })
})

describe('completeReservation 完成检查闭环', () => {
  it('生成检查记录 + 更新患者 + 设备今日检查量 + 状态流转', () => {
    const db = makeDb()
    const created = createReservation(db, { patientId: 'P1', deviceId: 'OCT-001', date: todayStr(), slot: '09:00-09:30' })
    const result = completeReservation(created.db, created.reservation.id)
    expect(result.ok).toBe(true)

    const newDb = result.db
    expect(newDb.reservations.find((r) => r.id === created.reservation.id).status).toBe('已完成')
    expect(newDb.exams).toHaveLength(2)
    const exam = newDb.exams[1]
    expect(exam.patientId).toBe('P1')
    expect(exam.date).toBe(todayStr())
    expect(exam.aiResult).toContain('青光眼')
    expect(exam.conclusion).toContain('视杯盘比增大')
    expect(newDb.patients.find((p) => p.id === 'P1').lastExamDate).toBe(todayStr())
    expect(newDb.patients.find((p) => p.id === 'P1').examCount).toBe(3)
    expect(newDb.devices.find((d) => d.id === 'OCT-001').todayCount).toBe(6)

    const timeline = getPatientExams(newDb.exams, 'P1')
    expect(timeline[0].id).toBe(exam.id)
    expect(timeline[0].date).toBe(todayStr())
  })

  it('仅待检查状态可完成；完成后不可重复完成', () => {
    const db = makeDb()
    const created = createReservation(db, { patientId: 'P2', deviceId: 'OCT-001', date: todayStr(), slot: '09:00-09:30' })
    const first = completeReservation(created.db, created.reservation.id)
    expect(first.ok).toBe(true)
    const second = completeReservation(first.db, created.reservation.id)
    expect(second.ok).toBe(false)
    expect(second.message).toContain('仅待检查状态可完成检查')
  })

  it('健康患者生成的记录为未见异常结论', () => {
    const db = makeDb()
    const created = createReservation(db, { patientId: 'P2', deviceId: 'OCT-001', date: todayStr(), slot: '09:00-09:30' })
    const result = completeReservation(created.db, created.reservation.id)
    expect(result.data.aiResult).toContain('未见明显异常')
    expect(result.data.conclusion).toContain('正常范围')
  })
})

describe('cancelReservation 取消预约', () => {
  it('待检查 → 已取消；非待检查拒绝；不存在拒绝', () => {
    const db = makeDb()
    const created = createReservation(db, { patientId: 'P1', deviceId: 'OCT-001', date: tomorrowStr(), slot: '09:00-09:30' })
    const canceled = cancelReservation(created.db, created.reservation.id)
    expect(canceled.ok).toBe(true)
    expect(canceled.db.reservations[0].status).toBe('已取消')
    const again = cancelReservation(canceled.db, created.reservation.id)
    expect(again.ok).toBe(false)
    expect(cancelReservation(db, 'R999').ok).toBe(false)
  })
})