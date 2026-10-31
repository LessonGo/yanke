import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { todayStr, minuteSeed, generatePatientFlow, generateKpis } from '../shared/generators.js'
import { filterAndSortPatients, paginate, aggregateTags, getPatientExams, enhanceExams } from '../shared/patientsQuery.js'
import {
  getReservations,
  createReservation,
  startReservation,
  completeReservation,
  cancelReservation
} from '../shared/reservationsCore.js'
import { READ_STAGES, ensureReport, reviewReport, getAiStats } from '../shared/reportsCore.js'
import {
  getDevicesLedger,
  buildDeviceDetail,
  setDeviceStatus,
  getOnlineSummary,
  deviceStatusLabel
} from '../shared/devicesCore.js'
import { getConsumables, adjustStock, getStockLogs } from '../shared/consumablesCore.js'
import { ensureMobileReport, buildMobilePatient } from '../shared/mobileCore.js'
import {
  buildSystemInfo,
  sanitizeUsers,
  getResetScopes,
  isValidResetScope,
  RESET_SCOPES
} from '../shared/systemCore.js'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '../shared/db.json')
let db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))

function persist() {
  const json = JSON.stringify(db, null, 2) + '\n'
  fs.truncateSync(DB_PATH, 0)
  fs.writeFileSync(DB_PATH, json, 'utf-8')
  const verify = fs.readFileSync(DB_PATH, 'utf-8')
  if (verify !== json) {
    fs.truncateSync(DB_PATH, 0)
    fs.writeFileSync(DB_PATH, json, 'utf-8')
    console.error('[eye-oct-backend] 持久化校验不一致，已重写一次')
  }
}

const app = express()
app.use(cors())
app.use(express.json())

function buildDashboard() {
  const seed = minuteSeed()
  const date = todayStr()
  const patientFlow = generatePatientFlow(`${seed}|flow`)
  const todayTotal = patientFlow.reduce((sum, item) => sum + item.count, 0)
  const onlineCount = db.devices.filter((d) => d.status === 'online').length
  const kpis = generateKpis(seed, todayTotal)
  kpis.push({
    key: 'onlineDevices',
    label: '设备在线',
    value: onlineCount,
    unit: `/ ${db.devices.length} 台`
  })
  return {
    date,
    patientFlow,
    kpis,
    diseases: db.diseases,
    regions: db.regions,
    devices: db.devices
  }
}

app.get('/api/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', service: 'eye-oct-backend' } })
})

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = db.users.find((u) => u.username === username && u.password === password)
  if (!user) {
    return res.json({ code: 1, message: '账号或密码错误' })
  }
  const { password: _pwd, ...safeUser } = user
  res.json({ code: 0, data: safeUser, message: '登录成功' })
})

app.get('/api/dashboard', (req, res) => {
  res.json({ code: 0, data: buildDashboard() })
})

app.get('/api/patients', (req, res) => {
  const { page, pageSize, keyword, tag } = req.query
  const filtered = filterAndSortPatients(db.patients, { keyword, tag })
  res.json({ code: 0, data: paginate(filtered, page, pageSize) })
})

app.get('/api/patient-tags', (req, res) => {
  res.json({ code: 0, data: aggregateTags(db.patients) })
})

app.get('/api/patients/:id', (req, res) => {
  const patient = db.patients.find((p) => p.id === req.params.id)
  if (!patient) {
    return res.json({ code: 1, message: '患者不存在' })
  }
  res.json({
    code: 0,
    data: { patient, exams: enhanceExams(getPatientExams(db.exams, patient.id), patient) }
  })
})

app.get('/api/devices', (req, res) => {
  const { status, model } = req.query
  res.json({
    code: 0,
    data: {
      list: getDevicesLedger(db, { status, model }),
      summary: getOnlineSummary(db)
    }
  })
})

app.get('/api/devices/:id', (req, res) => {
  const result = buildDeviceDetail(db, req.params.id)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  res.json({ code: 0, data: result.data })
})

app.post('/api/devices/:id/status', (req, res) => {
  const { status } = req.body || {}
  const result = setDeviceStatus(db, req.params.id, status)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  db = result.db
  persist()
  res.json({
    code: 0,
    data: result.device,
    message: `设备状态已切换为「${deviceStatusLabel(result.device.status)}」`
  })
})

app.get('/api/consumables', (req, res) => {
  const data = getConsumables(db)
  res.json({ code: 0, data: { ...data, logs: getStockLogs(db, 10) } })
})

app.post('/api/consumables/:id/stock', (req, res) => {
  const body = req.body || {}
  const result = adjustStock(db, req.params.id, {
    type: body.type,
    quantity: body.quantity,
    operator: body.operator,
    note: body.note
  })
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  db = result.db
  persist()
  res.json({
    code: 0,
    data: { consumable: result.consumable, log: result.log },
    message: `${body.type === 'in' ? '入库' : '出库'}登记成功，当前库存 ${result.consumable.stock}${result.consumable.unit}`
  })
})

app.get('/api/m/report/:examId', (req, res) => {
  const result = ensureMobileReport(db, req.params.examId)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  res.json({ code: 0, data: result.data })
})

app.get('/api/m/patient/:id', (req, res) => {
  const result = buildMobilePatient(db, req.params.id)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  res.json({ code: 0, data: result.data })
})

function formatServerTime() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function reloadDb() {
  db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

app.get('/api/system/info', (req, res) => {
  res.json({
    code: 0,
    data: buildSystemInfo(db, { serverTime: formatServerTime(), nodeVersion: process.version })
  })
})

app.get('/api/system/users', (req, res) => {
  res.json({ code: 0, data: sanitizeUsers(db.users) })
})

app.get('/api/system/reset-scopes', (req, res) => {
  res.json({ code: 0, data: getResetScopes() })
})

app.post('/api/system/reset', (req, res) => {
  const { scope } = req.body || {}
  if (!isValidResetScope(scope)) {
    return res.json({ code: 1, message: '数据复位范围无效' })
  }
  const targets = scope === 'all' ? RESET_SCOPES.filter((s) => s.script) : RESET_SCOPES.filter((s) => s.scope === scope)
  const executed = []
  try {
    targets.forEach((item) => {
      execFileSync(process.execPath, [path.join(__dirname, '../shared', item.script)], {
        cwd: path.join(__dirname, '../shared'),
        timeout: 60000,
        windowsHide: true
      })
      executed.push(item.label)
    })
    reloadDb()
    if (scope === 'all') {
      db.reports = []
      persist()
      reloadDb()
    }
    res.json({
      code: 0,
      data: { executed, counts: buildSystemInfo(db).counts },
      message: '数据复位完成'
    })
  } catch (err) {
    reloadDb()
    res.json({ code: 1, message: `数据复位失败：${err.message}` })
  }
})

app.get('/api/reservations', (req, res) => {
  const { status, date } = req.query
  res.json({ code: 0, data: getReservations(db, { status, date }) })
})

app.post('/api/reservations', (req, res) => {
  const result = createReservation(db, req.body || {})
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  db = result.db
  persist()
  res.json({ code: 0, data: result.reservation, message: '预约创建成功' })
})

app.post('/api/reservations/:id/start', (req, res) => {
  const result = startReservation(db, req.params.id)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  res.json({ code: 0, data: result.data })
})

app.post('/api/reservations/:id/complete', (req, res) => {
  const result = completeReservation(db, req.params.id)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  db = result.db
  persist()
  res.json({ code: 0, data: result.data, message: '检查完成，记录已生成' })
})

app.post('/api/reservations/:id/cancel', (req, res) => {
  const result = cancelReservation(db, req.params.id)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  db = result.db
  persist()
  res.json({ code: 0, data: { id: req.params.id, status: '已取消' }, message: '预约已取消' })
})

app.post('/api/ai/read', (req, res) => {
  const { examId } = req.body || {}
  const exam = (db.exams || []).find((e) => e.id === examId)
  if (!exam) {
    return res.json({ code: 1, message: '检查记录不存在' })
  }
  const patient = (db.patients || []).find((p) => p.id === exam.patientId)
  if (!patient) {
    return res.json({ code: 1, message: '患者数据异常' })
  }
  const result = ensureReport(db, exam, patient)
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  if (result.created) {
    db = result.db
    persist()
  }
  res.json({
    code: 0,
    data: {
      report: result.report,
      exam: { id: exam.id, date: exam.date, type: exam.type, deviceId: exam.deviceId },
      patient: { id: patient.id, name: patient.name, gender: patient.gender, age: patient.age, tags: patient.tags || [] },
      stages: READ_STAGES,
      created: result.created
    }
  })
})

app.post('/api/reports/:examId/review', (req, res) => {
  const body = req.body || {}
  const result = reviewReport(db, req.params.examId, {
    action: body.action,
    finalConclusion: body.finalConclusion,
    note: body.note,
    reviewer: body.reviewer
  })
  if (!result.ok) {
    return res.json({ code: 1, message: result.message })
  }
  db = result.db
  persist()
  res.json({ code: 0, data: result.report, message: '报告已签发' })
})

app.get('/api/ai/stats', (req, res) => {
  res.json({ code: 0, data: getAiStats(db) })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`[eye-oct-backend] 服务已启动: http://localhost:${PORT}`)
  console.log('[eye-oct-backend] 接口: GET /api/health, POST /api/login, GET /api/dashboard')
  console.log('[eye-oct-backend] 患者接口: GET /api/patients, GET /api/patient-tags, GET /api/patients/:id')
  console.log('[eye-oct-backend] 检查接口: GET/POST /api/reservations, POST /api/reservations/:id/start|complete|cancel')
  console.log('[eye-oct-backend] AI 接口: POST /api/ai/read, POST /api/reports/:examId/review, GET /api/ai/stats')
  console.log('[eye-oct-backend] 资产接口: GET /api/devices, GET /api/devices/:id, POST /api/devices/:id/status, GET /api/consumables, POST /api/consumables/:id/stock')
  console.log('[eye-oct-backend] 移动端只读接口: GET /api/m/report/:examId, GET /api/m/patient/:id')
  console.log('[eye-oct-backend] 系统设置接口: GET /api/system/info, GET /api/system/users, GET /api/system/reset-scopes, POST /api/system/reset')
  console.log('[eye-oct-backend] 写操作将实时持久化至 shared/db.json')
})