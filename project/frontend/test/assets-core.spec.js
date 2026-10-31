import { describe, it, expect } from 'vitest'
import {
  DEVICE_STATUSES,
  deviceStatusLabel,
  getDevicesLedger,
  getDeviceTrend,
  getDeviceExamStats,
  buildDeviceDetail,
  setDeviceStatus,
  getOnlineSummary
} from '../../shared/devicesCore.js'
import { getConsumables, decorateConsumable, adjustStock, getStockLogs } from '../../shared/consumablesCore.js'

function makeDb() {
  return {
    devices: [
      { id: 'OCT-001', name: 'SD-OCT 眼部扫描仪 01', model: 'SD-OCT-2000', location: '眼科门诊 1 诊室', status: 'online', usageRate: 86, todayCount: 42, totalScans: 4860, serialNo: 'SN-SDOCT2000-23-001', purchaseDate: '2023-03-15', warrantyUntil: '2026-03-15' },
      { id: 'OCT-002', name: 'SD-OCT 眼部扫描仪 02', model: 'SD-OCT-2000', location: '眼科门诊 2 诊室', status: 'maintenance', usageRate: 74, todayCount: 35, totalScans: 3980, serialNo: 'SN-SDOCT2000-23-002', purchaseDate: '2023-03-15', warrantyUntil: '2026-03-15' },
      { id: 'OCT-003', name: 'SS-OCT 深度成像仪 01', model: 'SS-OCT-100K', location: '眼科检查室', status: 'offline', usageRate: 0, todayCount: 0, totalScans: 3120, serialNo: 'SN-SSOCT100K-24-003', purchaseDate: '2024-06-20', warrantyUntil: '2027-06-20' }
    ],
    exams: [
      { id: 'E1', deviceId: 'OCT-001', date: '2026-10-20', type: 'SD-OCT 眼底断层扫描' },
      { id: 'E2', deviceId: 'OCT-001', date: '2026-10-05', type: 'SD-OCT 眼底断层扫描' },
      { id: 'E3', deviceId: 'OCT-001', date: '2026-09-11', type: 'SD-OCT 眼底断层扫描' },
      { id: 'E4', deviceId: 'OCT-003', date: '2026-08-02', type: 'SS-OCT 深度成像检查' }
    ],
    consumables: [
      { id: 'C001', name: 'OCT 光学镜片清洁纸', spec: '100 片/盒', unit: '盒', stock: 45, threshold: 10 },
      { id: 'C002', name: '超声耦合剂', spec: '250ml/瓶', unit: '瓶', stock: 12, threshold: 20 },
      { id: 'C003', name: '一次性检查眼罩', spec: '50 只/包', unit: '包', stock: 38, threshold: 50 }
    ],
    stockLogs: []
  }
}

describe('设备台账查询与筛选', () => {
  it('按状态与型号筛选', () => {
    const db = makeDb()
    expect(getDevicesLedger(db).length).toBe(3)
    expect(getDevicesLedger(db, { status: 'online' }).map((d) => d.id)).toEqual(['OCT-001'])
    expect(getDevicesLedger(db, { model: 'SS-OCT-100K' }).map((d) => d.id)).toEqual(['OCT-003'])
    expect(getDevicesLedger(db, { status: 'online', model: 'SS-OCT-100K' })).toEqual([])
  })

  it('在线汇总统计', () => {
    const s = getOnlineSummary(makeDb())
    expect(s).toEqual({ total: 3, online: 1, maintenance: 1, offline: 1 })
  })
})

describe('设备趋势与检查统计', () => {
  it('近 7 日趋势：7 个点、日期连续倒推、使用率 0-99', () => {
    const trend = getDeviceTrend(makeDb(), 'OCT-001', 7, '2026-10-28')
    expect(trend.length).toBe(7)
    expect(trend[trend.length - 1].date).toBe('2026-10-28')
    expect(trend[0].date).toBe('2026-10-22')
    trend.forEach((t) => {
      expect(t.usageRate).toBeGreaterThanOrEqual(0)
      expect(t.usageRate).toBeLessThanOrEqual(99)
      expect(t.scans).toBeGreaterThanOrEqual(0)
    })
  })

  it('趋势确定性：同日两次一致；跨日有变化', () => {
    const db = makeDb()
    const a = getDeviceTrend(db, 'OCT-001', 7, '2026-10-28')
    const b = getDeviceTrend(db, 'OCT-001', 7, '2026-10-28')
    expect(a).toEqual(b)
    const c = getDeviceTrend(db, 'OCT-001', 7, '2026-10-30')
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c))
  })

  it('离线设备趋势应显著低于在线设备', () => {
    const db = makeDb()
    const offlineAvg = getDeviceTrend(db, 'OCT-003', 7, '2026-10-28').reduce((s, t) => s + t.usageRate, 0) / 7
    const onlineAvg = getDeviceTrend(db, 'OCT-001', 7, '2026-10-28').reduce((s, t) => s + t.usageRate, 0) / 7
    expect(offlineAvg).toBeLessThan(onlineAvg)
  })

  it('检查统计：累计/本月/最近日期/今日检查', () => {
    const stats = getDeviceExamStats(makeDb(), 'OCT-001', '2026-10-28')
    expect(stats.total).toBe(3)
    expect(stats.thisMonth).toBe(2)
    expect(stats.lastDate).toBe('2026-10-20')
    expect(stats.todayCount).toBe(42)
    expect(stats.totalScans).toBe(4860)
  })

  it('buildDeviceDetail：设备不存在返回失败；存在返回设备+趋势+统计', () => {
    expect(buildDeviceDetail(makeDb(), 'X').ok).toBe(false)
    const result = buildDeviceDetail(makeDb(), 'OCT-001', '2026-10-28')
    expect(result.ok).toBe(true)
    expect(result.data.device.serialNo).toBe('SN-SDOCT2000-23-001')
    expect(result.data.trend.length).toBe(7)
    expect(result.data.stats.total).toBe(3)
  })
})

describe('设备状态切换', () => {
  it('合法切换返回新 db 并更新状态', () => {
    const result = setDeviceStatus(makeDb(), 'OCT-001', 'maintenance', '2026-10-28')
    expect(result.ok).toBe(true)
    expect(result.device.status).toBe('maintenance')
    expect(result.db.devices.find((d) => d.id === 'OCT-001').status).toBe('maintenance')
    expect(result.db.devices.find((d) => d.id === 'OCT-001').statusUpdatedAt).toBe('2026-10-28')
  })

  it('同状态切换被拒绝；非法状态被拒绝；设备不存在被拒绝', () => {
    const db = makeDb()
    expect(setDeviceStatus(db, 'OCT-001', 'online').ok).toBe(false)
    expect(setDeviceStatus(db, 'OCT-001', 'broken').ok).toBe(false)
    expect(setDeviceStatus(db, 'X', 'online').ok).toBe(false)
  })

  it('在线台数随状态切换变化', () => {
    const r = setDeviceStatus(makeDb(), 'OCT-003', 'online')
    expect(getOnlineSummary(r.db).online).toBe(2)
    expect(getOnlineSummary(r.db).offline).toBe(0)
  })

  it('状态中文标签映射', () => {
    expect(deviceStatusLabel('online')).toBe('在线')
    expect(deviceStatusLabel('maintenance')).toBe('维护中')
    expect(deviceStatusLabel('offline')).toBe('离线')
    expect(DEVICE_STATUSES).toEqual(['online', 'offline', 'maintenance'])
  })
})

describe('耗材库存与告警', () => {
  it('低库存标记与告警计数', () => {
    const data = getConsumables(makeDb())
    expect(data.total).toBe(3)
    expect(data.lowStockCount).toBe(2)
    expect(data.list.find((c) => c.id === 'C002').lowStock).toBe(true)
    expect(data.list.find((c) => c.id === 'C001').lowStock).toBe(false)
  })

  it('库存水位比例：以阈值两倍为满格', () => {
    expect(decorateConsumable({ stock: 20, threshold: 20, unit: '瓶' }).stockLevel).toBe(50)
    expect(decorateConsumable({ stock: 40, threshold: 20, unit: '瓶' }).stockLevel).toBe(100)
    expect(decorateConsumable({ stock: 50, threshold: 20, unit: '瓶' }).stockLevel).toBe(100)
  })
})

describe('出入库操作', () => {
  function timeAt(str) {
    const [d, t] = str.split(' ')
    const [y, m, day] = d.split('-').map(Number)
    const [hh, mm, ss] = t.split(':').map(Number)
    return new Date(y, m - 1, day, hh, mm, ss)
  }

  it('出库成功：库存减少并记录流水', () => {
    const result = adjustStock(makeDb(), 'C001', { type: 'out', quantity: 5, operator: '王强技师', note: '门诊使用' }, timeAt('2026-10-28 10:20:30'))
    expect(result.ok).toBe(true)
    expect(result.consumable.stock).toBe(40)
    expect(result.log.type).toBe('out')
    expect(result.log.operator).toBe('王强技师')
    expect(result.log.balanceAfter).toBe(40)
    expect(result.log.time).toBe('2026-10-28 10:20:30')
    expect(result.db.stockLogs).toHaveLength(1)
  })

  it('入库成功：库存增加', () => {
    const result = adjustStock(makeDb(), 'C002', { type: 'in', quantity: 30, operator: '李婷护士' }, timeAt('2026-10-28 11:00:00'))
    expect(result.ok).toBe(true)
    expect(result.consumable.stock).toBe(42)
    expect(result.consumable.lowStock).toBe(false)
  })

  it('超量出库被拒绝', () => {
    const result = adjustStock(makeDb(), 'C002', { type: 'out', quantity: 13, operator: '王强技师' })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('超过当前库存')
  })

  it('数量非法被拒绝（0/负数/小数/非数字）', () => {
    const db = makeDb()
    expect(adjustStock(db, 'C001', { type: 'out', quantity: 0 }).ok).toBe(false)
    expect(adjustStock(db, 'C001', { type: 'out', quantity: -3 }).ok).toBe(false)
    expect(adjustStock(db, 'C001', { type: 'out', quantity: 2.5 }).ok).toBe(false)
    expect(adjustStock(db, 'C001', { type: 'out', quantity: 'abc' }).ok).toBe(false)
  })

  it('类型非法/耗材不存在被拒绝', () => {
    expect(adjustStock(makeDb(), 'C001', { type: 'move', quantity: 1 }).ok).toBe(false)
    expect(adjustStock(makeDb(), 'C999', { type: 'in', quantity: 1 }).ok).toBe(false)
  })

  it('流水倒序返回最近记录且限制条数', () => {
    let db = makeDb()
    db = adjustStock(db, 'C001', { type: 'out', quantity: 1, operator: 'A' }).db
    db = adjustStock(db, 'C001', { type: 'out', quantity: 2, operator: 'B' }).db
    db = adjustStock(db, 'C001', { type: 'in', quantity: 3, operator: 'C' }).db
    const logs = getStockLogs(db, 2)
    expect(logs).toHaveLength(2)
    expect(logs[0].operator).toBe('C')
    expect(logs[1].operator).toBe('B')
  })

  it('未署名经办人回退为「未署名」', () => {
    const result = adjustStock(makeDb(), 'C001', { type: 'in', quantity: 1 })
    expect(result.log.operator).toBe('未署名')
  })
})