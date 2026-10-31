import { describe, it, expect } from 'vitest'
import {
  APP_NAME,
  APP_VERSION,
  buildSystemInfo,
  sanitizeUsers,
  getResetScopes,
  isValidResetScope
} from '../../shared/systemCore.js'

function makeDb() {
  return {
    users: [
      { username: 'admin', password: '123456', name: '系统管理员', role: 'admin', roleName: '管理员' },
      { username: 'tech', password: '123456', name: '王强技师', role: 'tech', roleName: '设备技师' }
    ],
    patients: new Array(40).fill({}),
    exams: new Array(155).fill({}),
    reservations: new Array(17).fill({}),
    devices: new Array(8).fill({}),
    consumables: new Array(14).fill({}),
    reports: [],
    stockLogs: []
  }
}

describe('buildSystemInfo 系统信息汇总', () => {
  it('返回应用标识与技术栈及完整数据规模', () => {
    const info = buildSystemInfo(makeDb(), { serverTime: '2026-10-29 10:00:00', nodeVersion: 'v24.13.0' })
    expect(info.appName).toBe(APP_NAME)
    expect(info.version).toBe(APP_VERSION)
    expect(info.dataSource).toContain('JSON 文件库')
    expect(info.frontend).toContain('Vue 3')
    expect(info.backend).toContain('Express')
    expect(info.serverTime).toBe('2026-10-29 10:00:00')
    expect(info.nodeVersion).toBe('v24.13.0')
    expect(info.counts).toEqual({
      users: 2,
      patients: 40,
      exams: 155,
      reservations: 17,
      devices: 8,
      consumables: 14,
      reports: 0,
      stockLogs: 0
    })
  })

  it('字段缺失时按 0 处理（容错）', () => {
    const info = buildSystemInfo({})
    expect(info.counts.patients).toBe(0)
    expect(info.counts.reports).toBe(0)
  })
})

describe('sanitizeUsers 账号脱敏', () => {
  it('移除 password 且保留其余字段', () => {
    const users = sanitizeUsers(makeDb().users)
    expect(users).toHaveLength(2)
    users.forEach((u) => {
      expect(u.password).toBeUndefined()
      expect(u.username).toBeTruthy()
      expect(u.roleName).toBeTruthy()
    })
    expect(users[0]).toMatchObject({ username: 'admin', name: '系统管理员', role: 'admin' })
  })

  it('空输入返回空数组', () => {
    expect(sanitizeUsers(undefined)).toEqual([])
  })
})

describe('数据复位范围', () => {
  it('包含四个范围且脚本映射正确', () => {
    const scopes = getResetScopes()
    expect(scopes.map((s) => s.scope)).toEqual(['patients', 'assets', 'reservations', 'all'])
    expect(scopes.find((s) => s.scope === 'patients').script).toBe('generate-patients.mjs')
    expect(scopes.find((s) => s.scope === 'assets').script).toBe('generate-assets.mjs')
    expect(scopes.find((s) => s.scope === 'reservations').script).toBe('generate-reservations.mjs')
    expect(scopes.find((s) => s.scope === 'all').script).toBeNull()
  })

  it('每个范围都有中文名称与说明', () => {
    getResetScopes().forEach((s) => {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.description.length).toBeGreaterThan(0)
    })
  })

  it('返回副本，外部修改不影响内部常量', () => {
    const first = getResetScopes()
    first[0].label = '被篡改'
    expect(getResetScopes()[0].label).not.toBe('被篡改')
  })

  it('isValidResetScope 校验合法与非法范围', () => {
    expect(isValidResetScope('patients')).toBe(true)
    expect(isValidResetScope('all')).toBe(true)
    expect(isValidResetScope('users')).toBe(false)
    expect(isValidResetScope('')).toBe(false)
    expect(isValidResetScope(undefined)).toBe(false)
  })
})