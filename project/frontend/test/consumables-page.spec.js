import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  list: [],
  logs: [],
  lowStockCount: 0,
  total: 0,
  stockCalls: [],
  stockShouldFail: null
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }
})

vi.mock('../src/stores/auth', () => ({
  useAuthStore: () => ({ displayName: '王强技师', role: 'tech', roleName: '设备技师' })
}))

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getConsumables: () => Promise.resolve({ list: state.list, logs: state.logs, lowStockCount: state.lowStockCount, total: state.total }),
    adjustStock: (id, payload) => {
      state.stockCalls.push({ id, payload })
      if (state.stockShouldFail) {
        return Promise.reject(new Error(state.stockShouldFail))
      }
      const target = state.list.find((c) => c.id === id)
      const next = payload.type === 'in' ? target.stock + payload.quantity : target.stock - payload.quantity
      state.list = state.list.map((c) =>
        c.id === id ? { ...c, stock: next, lowStock: next < c.threshold, stockLevel: Math.min(100, Math.round((next / (c.threshold * 2)) * 100)) } : c
      )
      state.lowStockCount = state.list.filter((c) => c.lowStock).length
      state.logs = [
        { id: 'L1', consumableId: id, consumableName: target.name, type: payload.type, quantity: payload.quantity, unit: target.unit, operator: payload.operator, note: payload.note, time: '2026-10-28 12:00:00', balanceAfter: next },
        ...state.logs
      ]
      return Promise.resolve({ consumable: state.list.find((c) => c.id === id), log: state.logs[0] })
    }
  }
}))

import Consumables from '../src/views/Consumables.vue'
import { ElMessage } from 'element-plus'

const ElementPlus = (await import('element-plus')).default

function seed() {
  return [
    { id: 'C001', name: 'OCT 光学镜片清洁纸', spec: '100 片/盒', unit: '盒', stock: 45, threshold: 10, lowStock: false, stockLevel: 100 },
    { id: 'C002', name: '超声耦合剂', spec: '250ml/瓶', unit: '瓶', stock: 12, threshold: 20, lowStock: true, stockLevel: 30 },
    { id: 'C003', name: '一次性检查眼罩', spec: '50 只/包', unit: '包', stock: 38, threshold: 50, lowStock: true, stockLevel: 38 },
    { id: 'C014', name: '设备防尘罩', spec: '通用型 90×70cm', unit: '个', stock: 14, threshold: 8, lowStock: false, stockLevel: 88 }
  ]
}

async function mountPage() {
  const wrapper = mount(Consumables, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('耗材管理页', () => {
  beforeEach(() => {
    state.list = seed()
    state.lowStockCount = 2
    state.total = 4
    state.stockCalls = []
    state.stockShouldFail = null
    state.logs = []
  })

  it('渲染耗材列表 + 低库存告警条（数量与明细正确）', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('.el-table__body tr').length).toBeGreaterThanOrEqual(4)
    const text = wrapper.text()
    expect(text).toContain('2 种耗材低于安全阈值')
    expect(text).toContain('超声耦合剂（12/20瓶）')
    expect(text).toContain('一次性检查眼罩（38/50包）')
    expect(text).toContain('库存告警')
    expect(text).toContain('低于阈值 8瓶')
  })

  it('全部充足时展示绿色提示', async () => {
    state.list = state.list.map((c) => ({ ...c, lowStock: false, stock: 99 }))
    state.lowStockCount = 0
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('全部耗材库存充足')
  })

  it('关键字搜索过滤列表', async () => {
    const wrapper = await mountPage()
    wrapper.vm.keyword = '耦合剂'
    await flushPromises()
    expect(wrapper.vm.filteredRows.length).toBe(1)
    expect(wrapper.text()).toContain('超声耦合剂')
  })

  it('出库登记成功：接口参数正确、库存减少、流水记录追加', async () => {
    const wrapper = await mountPage()
    wrapper.vm.openStockDialog(state.list[0], 'out')
    wrapper.vm.stockForm.quantity = 5
    wrapper.vm.stockForm.operator = '王强技师'
    wrapper.vm.stockForm.note = '门诊使用'
    await wrapper.vm.handleSubmit()
    await flushPromises()
    expect(state.stockCalls).toEqual([
      { id: 'C001', payload: { type: 'out', quantity: 5, operator: '王强技师', note: '门诊使用' } }
    ])
    expect(state.list.find((c) => c.id === 'C001').stock).toBe(40)
    expect(wrapper.text()).toContain('门诊使用')
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('超量出库被前端拦截（不发请求）并提示', async () => {
    const wrapper = await mountPage()
    wrapper.vm.openStockDialog(state.list[1], 'out')
    wrapper.vm.stockForm.quantity = 13
    wrapper.vm.stockForm.operator = '王强技师'
    await wrapper.vm.handleSubmit()
    await flushPromises()
    expect(state.stockCalls).toHaveLength(0)
    expect(wrapper.text()).toContain('超过当前库存')
  })

  it('经办人未填时拦截；数量非法时拦截', async () => {
    const wrapper = await mountPage()
    wrapper.vm.openStockDialog(state.list[0], 'in')
    wrapper.vm.stockForm.quantity = 5
    wrapper.vm.stockForm.operator = ''
    await wrapper.vm.handleSubmit()
    expect(wrapper.text()).toContain('请填写经办人')

    wrapper.vm.stockForm.operator = '王强技师'
    wrapper.vm.stockForm.quantity = 0
    await wrapper.vm.handleSubmit()
    expect(wrapper.text()).toContain('数量必须为正整数')
    expect(state.stockCalls).toHaveLength(0)
  })

  it('入库成功：低库存耗材补货后告警解除', async () => {
    const wrapper = await mountPage()
    wrapper.vm.openStockDialog(state.list[1], 'in')
    wrapper.vm.stockForm.quantity = 30
    wrapper.vm.stockForm.operator = '王强技师'
    await wrapper.vm.handleSubmit()
    await flushPromises()
    expect(state.list.find((c) => c.id === 'C002').stock).toBe(42)
    expect(state.list.find((c) => c.id === 'C002').lowStock).toBe(false)
    expect(wrapper.text()).toContain('1 种耗材低于安全阈值')
  })

  it('后端拒绝出库（并发场景）时展示错误且对话框保留', async () => {
    const wrapper = await mountPage()
    state.stockShouldFail = '出库数量 5 超过当前库存 3瓶'
    wrapper.vm.openStockDialog(state.list[0], 'out')
    wrapper.vm.stockForm.quantity = 5
    wrapper.vm.stockForm.operator = '王强技师'
    await wrapper.vm.handleSubmit()
    await flushPromises()
    expect(wrapper.vm.stockForm.quantity).toBe(5)
    expect(wrapper.text()).toContain('超过当前库存')
  })
})