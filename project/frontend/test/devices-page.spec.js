import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  list: [],
  summary: { total: 0, online: 0, maintenance: 0, offline: 0 },
  detail: null,
  statusCalls: [],
  statusShouldFail: null,
  getDevicesCalls: []
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }
})

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getDevices: (params) => {
      state.getDevicesCalls.push(params)
      let list = state.list
      if (params && params.status) list = list.filter((d) => d.status === params.status)
      if (params && params.model) list = list.filter((d) => d.model === params.model)
      return Promise.resolve({ list, summary: state.summary })
    },
    getDeviceDetail: () => Promise.resolve(state.detail),
    setDeviceStatus: (id, status) => {
      state.statusCalls.push({ id, status })
      if (state.statusShouldFail) {
        return Promise.reject(new Error(state.statusShouldFail))
      }
      state.list = state.list.map((d) => (d.id === id ? { ...d, status } : d))
      state.summary = { ...state.summary, online: state.list.filter((d) => d.status === 'online').length }
      return Promise.resolve({ id, status })
    }
  }
}))

import Devices from '../src/views/Devices.vue'
import { ElMessage } from 'element-plus'

const ElementPlus = (await import('element-plus')).default

function seedDevices() {
  return [
    { id: 'OCT-001', name: 'SD-OCT 眼部扫描仪 01', model: 'SD-OCT-2000', location: '眼科门诊 1 诊室', status: 'online', usageRate: 86, todayCount: 42, totalScans: 4860, serialNo: 'SN-SDOCT2000-23-001', purchaseDate: '2023-03-15', warrantyUntil: '2026-03-15' },
    { id: 'OCT-002', name: 'SD-OCT 眼部扫描仪 02', model: 'SD-OCT-2000', location: '眼科门诊 2 诊室', status: 'online', usageRate: 74, todayCount: 35, totalScans: 3980, serialNo: 'SN-SDOCT2000-23-002', purchaseDate: '2023-03-15', warrantyUntil: '2026-03-15' },
    { id: 'OCT-003', name: 'SS-OCT 深度成像仪 01', model: 'SS-OCT-100K', location: '眼科检查室', status: 'maintenance', usageRate: 0, todayCount: 0, totalScans: 3120, serialNo: 'SN-SSOCT100K-24-003', purchaseDate: '2024-06-20', warrantyUntil: '2027-06-20' }
  ]
}

async function mountPage() {
  const wrapper = mount(Devices, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('设备台账管理页', () => {
  beforeEach(() => {
    state.list = seedDevices()
    state.summary = { total: 3, online: 2, maintenance: 1, offline: 0 }
    state.statusCalls = []
    state.statusShouldFail = null
    state.getDevicesCalls = []
    state.detail = {
      device: seedDevices()[0],
      trend: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${22 + i}`, usageRate: 80 + i, scans: 30 + i })),
      stats: { total: 18, thisMonth: 6, lastDate: '2026-10-20', todayCount: 42, totalScans: 4860, byType: {} }
    }
  })

  it('渲染 8 台设备台账（含状态/使用率/今日/累计检查）', async () => {
    state.list = seedDevices()
    const wrapper = await mountPage()
    expect(wrapper.findAll('.el-table__body tr').length).toBe(3)
    const text = wrapper.text()
    expect(text).toContain('OCT-001')
    expect(text).toContain('SD-OCT 眼部扫描仪 01')
    expect(text).toContain('在线')
    expect(text).toContain('维护中')
    expect(text).toContain('4860')
    expect(text).toContain('共 3 台 · 在线 2 · 维护中 1 · 离线 0')
  })

  it('按状态筛选只请求并展示对应设备', async () => {
    const wrapper = await mountPage()
    state.getDevicesCalls = []
    wrapper.vm.filters.status = 'online'
    await wrapper.vm.load()
    await flushPromises()
    expect(state.getDevicesCalls[0]).toMatchObject({ status: 'online' })
    expect(wrapper.findAll('.el-table__body tr').length).toBe(2)
  })

  it('切换设备状态为维护中：调用接口、列表与汇总同步更新', async () => {
    const wrapper = await mountPage()
    await wrapper.vm.handleStatus({ id: 'OCT-001' }, 'maintenance')
    await flushPromises()
    expect(state.statusCalls).toEqual([{ id: 'OCT-001', status: 'maintenance' }])
    expect(wrapper.text()).toContain('在线 1')
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('状态切换失败（同状态）时提示错误且列表不变', async () => {
    const wrapper = await mountPage()
    state.statusShouldFail = '设备已处于「在线」状态'
    await wrapper.vm.handleStatus({ id: 'OCT-001' }, 'online')
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalled()
    expect(state.list.find((d) => d.id === 'OCT-001').status).toBe('online')
  })

  it('打开详情抽屉：展示台账信息、检查统计与趋势图容器', async () => {
    const wrapper = await mountPage()
    await wrapper.vm.openDetail({ id: 'OCT-001' })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))
    await flushPromises()
    expect(wrapper.vm.detail).toBeTruthy()
    const text = wrapper.text()
    expect(text).toContain('SN-SDOCT2000-23-001')
    expect(text).toContain('2023-03-15')
    expect(text).toContain('2026-03-15')
    expect(text).toContain('4860 次')
    expect(text).toContain('18')
    expect(text).toContain('2026-10-20')
    expect(wrapper.find('.trend-chart').exists()).toBe(true)
  })
})