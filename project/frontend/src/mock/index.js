import dbSource from '../../../shared/db.json'
import { todayStr, minuteSeed, generatePatientFlow, generateKpis } from '../../../shared/generators.js'
import { filterAndSortPatients, paginate, aggregateTags, getPatientExams, enhanceExams } from '../../../shared/patientsQuery.js'
import {
  getReservations,
  createReservation,
  startReservation,
  completeReservation,
  cancelReservation
} from '../../../shared/reservationsCore.js'
import { READ_STAGES, ensureReport, reviewReport, getAiStats } from '../../../shared/reportsCore.js'
import { getDevicesLedger, buildDeviceDetail, setDeviceStatus, getOnlineSummary, deviceStatusLabel } from '../../../shared/devicesCore.js'
import { getConsumables, adjustStock, getStockLogs } from '../../../shared/consumablesCore.js'
import { ensureMobileReport, buildMobilePatient } from '../../../shared/mobileCore.js'
import { buildSystemInfo, sanitizeUsers, getResetScopes, isValidResetScope } from '../../../shared/systemCore.js'

const MOCK_LATENCY = 600

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let mockDb = JSON.parse(JSON.stringify(dbSource))

function buildDashboard() {
  const seed = minuteSeed()
  const date = todayStr()
  const patientFlow = generatePatientFlow(`${seed}|flow`)
  const todayTotal = patientFlow.reduce((sum, item) => sum + item.count, 0)
  const onlineCount = mockDb.devices.filter((d) => d.status === 'online').length
  const kpis = generateKpis(seed, todayTotal)
  kpis.push({
    key: 'onlineDevices',
    label: '设备在线',
    value: onlineCount,
    unit: `/ ${mockDb.devices.length} 台`
  })
  return {
    date,
    patientFlow,
    kpis,
    diseases: mockDb.diseases,
    regions: mockDb.regions,
    devices: mockDb.devices
  }
}

function parseBody(options) {
  try {
    return typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {}
  } catch {
    return {}
  }
}

export async function mockApi(path, options = {}) {
  await sleep(MOCK_LATENCY)
  const [route, query] = String(path).split('?')
  const params = {}
  if (query) {
    for (const [k, v] of new URLSearchParams(query)) {
      params[k] = v
    }
  }

  if (route === '/api/login') {
    const body = parseBody(options)
    const user = mockDb.users.find((u) => u.username === body.username && u.password === body.password)
    if (!user) {
      return { code: 1, message: '账号或密码错误' }
    }
    const { password: _pwd, ...safeUser } = user
    return { code: 0, data: safeUser, message: '登录成功' }
  }

  if (route === '/api/dashboard') {
    return { code: 0, data: buildDashboard() }
  }

  if (route === '/api/patients') {
    const filtered = filterAndSortPatients(mockDb.patients, {
      keyword: params.keyword || '',
      tag: params.tag || ''
    })
    return { code: 0, data: paginate(filtered, params.page, params.pageSize) }
  }

  if (route === '/api/patient-tags') {
    return { code: 0, data: aggregateTags(mockDb.patients) }
  }

  const patientMatch = route.match(/^\/api\/patients\/([^/]+)$/)
  if (patientMatch) {
    const patient = mockDb.patients.find((p) => p.id === decodeURIComponent(patientMatch[1]))
    if (!patient) {
      return { code: 1, message: '患者不存在' }
    }
    return { code: 0, data: { patient, exams: enhanceExams(getPatientExams(mockDb.exams, patient.id), patient) } }
  }

  if (route === '/api/reservations' && (options.method || 'GET') === 'GET') {
    return { code: 0, data: getReservations(mockDb, { status: params.status || '', date: params.date || '' }) }
  }
  if (route === '/api/reservations' && (options.method || 'GET') === 'POST') {
    const result = createReservation(mockDb, parseBody(options))
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    mockDb = result.db
    return { code: 0, data: result.reservation, message: '预约创建成功' }
  }
  const startMatch = route.match(/^\/api\/reservations\/([^/]+)\/start$/)
  if (startMatch) {
    const result = startReservation(mockDb, decodeURIComponent(startMatch[1]))
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    return { code: 0, data: result.data }
  }
  const completeMatch = route.match(/^\/api\/reservations\/([^/]+)\/complete$/)
  if (completeMatch) {
    const result = completeReservation(mockDb, decodeURIComponent(completeMatch[1]))
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    mockDb = result.db
    return { code: 0, data: result.data, message: '检查完成，记录已生成' }
  }
  const cancelMatch = route.match(/^\/api\/reservations\/([^/]+)\/cancel$/)
  if (cancelMatch) {
    const result = cancelReservation(mockDb, decodeURIComponent(cancelMatch[1]))
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    mockDb = result.db
    return { code: 0, data: { id: decodeURIComponent(cancelMatch[1]), status: '已取消' }, message: '预约已取消' }
  }

  if (route === '/api/ai/stats') {
    return { code: 0, data: getAiStats(mockDb) }
  }
  if (route === '/api/ai/read') {
    const body = parseBody(options)
    const exam = (mockDb.exams || []).find((e) => e.id === body.examId)
    if (!exam) {
      return { code: 1, message: '检查记录不存在' }
    }
    const patient = (mockDb.patients || []).find((p) => p.id === exam.patientId)
    if (!patient) {
      return { code: 1, message: '患者数据异常' }
    }
    const result = ensureReport(mockDb, exam, patient)
    if (result.created) {
      mockDb = result.db
    }
    return {
      code: 0,
      data: {
        report: result.report,
        exam: { id: exam.id, date: exam.date, type: exam.type, deviceId: exam.deviceId },
        patient: { id: patient.id, name: patient.name, gender: patient.gender, age: patient.age, tags: patient.tags || [] },
        stages: READ_STAGES,
        created: result.created
      }
    }
  }
  const reviewMatch = route.match(/^\/api\/reports\/([^/]+)\/review$/)
  if (reviewMatch) {
    const body = parseBody(options)
    const result = reviewReport(mockDb, decodeURIComponent(reviewMatch[1]), {
      action: body.action,
      finalConclusion: body.finalConclusion,
      note: body.note,
      reviewer: body.reviewer
    })
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    mockDb = result.db
    return { code: 0, data: result.report, message: '报告已签发' }
  }

  if (route === '/api/devices') {
    return {
      code: 0,
      data: {
        list: getDevicesLedger(mockDb, { status: params.status || '', model: params.model || '' }),
        summary: getOnlineSummary(mockDb)
      }
    }
  }
  const deviceDetailMatch = route.match(/^\/api\/devices\/([^/]+)$/)
  if (deviceDetailMatch) {
    const result = buildDeviceDetail(mockDb, decodeURIComponent(deviceDetailMatch[1]))
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    return { code: 0, data: result.data }
  }
  const deviceStatusMatch = route.match(/^\/api\/devices\/([^/]+)\/status$/)
  if (deviceStatusMatch) {
    const body = parseBody(options)
    const result = setDeviceStatus(mockDb, decodeURIComponent(deviceStatusMatch[1]), body.status)
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    mockDb = result.db
    return { code: 0, data: result.device, message: `设备状态已切换为「${deviceStatusLabel(result.device.status)}」` }
  }

  if (route === '/api/consumables') {
    const data = getConsumables(mockDb)
    return { code: 0, data: { ...data, logs: getStockLogs(mockDb, 10) } }
  }
  const stockMatch = route.match(/^\/api\/consumables\/([^/]+)\/stock$/)
  if (stockMatch) {
    const body = parseBody(options)
    const result = adjustStock(mockDb, decodeURIComponent(stockMatch[1]), {
      type: body.type,
      quantity: body.quantity,
      operator: body.operator,
      note: body.note
    })
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    mockDb = result.db
    return {
      code: 0,
      data: { consumable: result.consumable, log: result.log },
      message: `${body.type === 'in' ? '入库' : '出库'}登记成功，当前库存 ${result.consumable.stock}${result.consumable.unit}`
    }
  }

  const mobileReportMatch = route.match(/^\/api\/m\/report\/([^/]+)$/)
  if (mobileReportMatch) {
    const result = ensureMobileReport(mockDb, decodeURIComponent(mobileReportMatch[1]))
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    return { code: 0, data: result.data }
  }
  const mobilePatientMatch = route.match(/^\/api\/m\/patient\/([^/]+)$/)
  if (mobilePatientMatch) {
    const result = buildMobilePatient(mockDb, decodeURIComponent(mobilePatientMatch[1]))
    if (!result.ok) {
      return { code: 1, message: result.message }
    }
    return { code: 0, data: result.data }
  }

  if (route === '/api/system/info') {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return {
      code: 0,
      data: buildSystemInfo(mockDb, {
        serverTime: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        nodeVersion: 'mock 模式'
      })
    }
  }
  if (route === '/api/system/users') {
    return { code: 0, data: sanitizeUsers(mockDb.users) }
  }
  if (route === '/api/system/reset-scopes') {
    return { code: 0, data: getResetScopes() }
  }
  if (route === '/api/system/reset') {
    const body = parseBody(options)
    if (!isValidResetScope(body.scope)) {
      return { code: 1, message: '数据复位范围无效' }
    }
    return { code: 1, message: '数据复位需后端服务在线（Mock 只读模式下不可用）' }
  }

  if (route === '/api/health') {
    return { code: 0, data: { status: 'mock' } }
  }
  return { code: 404, message: `Mock 未定义路由: ${route}` }
}