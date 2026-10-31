export const APP_NAME = '眼科 OCT 智慧管理平台（演示系统）'
export const APP_VERSION = '1.0.0'

export const RESET_SCOPES = [
  {
    scope: 'patients',
    label: '患者与检查记录',
    description: '重置为 40 名患者 / 155 条检查记录',
    script: 'generate-patients.mjs'
  },
  {
    scope: 'assets',
    label: '设备与耗材',
    description: '重置设备台账与状态、14 种耗材库存，清空出入库流水',
    script: 'generate-assets.mjs'
  },
  {
    scope: 'reservations',
    label: '检查预约',
    description: '重置为 17 条初始预约（今日 7 / 明日 5 / 后日 5）',
    script: 'generate-reservations.mjs'
  },
  {
    scope: 'all',
    label: '全部演示数据',
    description: '依次重置患者、设备耗材、预约，并清空 AI 诊断报告',
    script: null
  }
]

export function getResetScopes() {
  return RESET_SCOPES.map((item) => ({ ...item }))
}

export function isValidResetScope(scope) {
  return RESET_SCOPES.some((item) => item.scope === scope)
}

export function buildSystemInfo(db, { serverTime = '', nodeVersion = '' } = {}) {
  const counts = {
    users: (db.users || []).length,
    patients: (db.patients || []).length,
    exams: (db.exams || []).length,
    reservations: (db.reservations || []).length,
    devices: (db.devices || []).length,
    consumables: (db.consumables || []).length,
    reports: (db.reports || []).length,
    stockLogs: (db.stockLogs || []).length
  }
  return {
    appName: APP_NAME,
    version: APP_VERSION,
    dataSource: 'JSON 文件库（shared/db.json）',
    frontend: 'Vue 3 + Element Plus + Vite + ECharts',
    backend: 'Node.js + Express（REST API）',
    serverTime,
    nodeVersion,
    counts
  }
}

export function sanitizeUsers(users) {
  return (users || []).map((user) => {
    const { password: _password, ...safe } = user
    return safe
  })
}