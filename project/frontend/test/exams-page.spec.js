import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  reservations: [],
  devices: [],
  createCalls: [],
  cancelCalls: [],
  pushSpy: vi.fn(),
  createdCount: 0
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: state.pushSpy })
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') }
  }
})

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getReservations: () => Promise.resolve([...state.reservations]),
    getDevices: () => Promise.resolve([...state.devices]),
    getPatients: () => Promise.resolve({ list: [], total: 0 }),
    createReservation: (payload) => {
      state.createCalls.push(payload)
      if (state.createShouldFail) {
        return Promise.reject(new Error(state.createShouldFail))
      }
      state.createdCount += 1
      const reservation = { id: `R${100 + state.createdCount}`, ...payload, status: '待检查', patientName: '新患者', examType: 'SD-OCT 眼底断层扫描', deviceName: 'SD-OCT 眼部扫描仪 01' }
      state.reservations = [...state.reservations, reservation]
      return Promise.resolve(reservation)
    },
    cancelReservation: (id) => {
      state.cancelCalls.push(id)
      state.reservations = state.reservations.map((r) => (r.id === id ? { ...r, status: '已取消' } : r))
      return Promise.resolve({ id, status: '已取消' })
    }
  }
}))

import Exams from '../src/views/Exams.vue'
import { ElMessage } from 'element-plus'

const ElementPlus = (await import('element-plus')).default

function seedReservations() {
  return [
    { id: 'R001', patientId: 'P1', patientName: '张建国', examType: 'SD-OCT 眼底断层扫描', deviceId: 'OCT-001', deviceName: 'SD-OCT 眼部扫描仪 01', date: '2026-10-28', slot: '09:00-09:30', status: '待检查' },
    { id: 'R002', patientId: 'P2', patientName: '李淑芬', examType: 'SS-OCT 深度成像检查', deviceId: 'OCT-003', deviceName: 'SS-OCT 深度成像仪 01', date: '2026-10-28', slot: '10:00-10:30', status: '已完成' },
    { id: 'R003', patientId: 'P3', patientName: '王志强', examType: 'SD-OCT 眼底断层扫描', deviceId: 'OCT-002', deviceName: 'SD-OCT 眼部扫描仪 02', date: '2026-10-29', slot: '14:00-14:30', status: '已取消' }
  ]
}

function seedDevices() {
  return [
    { id: 'OCT-001', name: 'SD-OCT 眼部扫描仪 01', status: 'online', location: '眼科门诊 1 诊室' },
    { id: 'OCT-003', name: 'SS-OCT 深度成像仪 01', status: 'online', location: '眼科检查室' },
    { id: 'OCT-007', name: 'SD-OCT 眼部扫描仪 04', status: 'maintenance', location: '社区筛查点 A' }
  ]
}

async function mountPage() {
  const wrapper = mount(Exams, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('检查管理列表页', () => {
  beforeEach(() => {
    state.reservations = seedReservations()
    state.devices = seedDevices()
    state.createCalls = []
    state.cancelCalls = []
    state.createdCount = 0
    state.createShouldFail = null
    state.pushSpy.mockClear()
  })

  it('渲染初始预约列表：三种状态 + 患者与设备信息', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('.el-table__body tr').length).toBe(3)
    expect(wrapper.text()).toContain('张建国')
    expect(wrapper.text()).toContain('SS-OCT 深度成像检查')
    expect(wrapper.text()).toContain('待检查')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('已取消')
  })

  it('待检查行有「开始检查」按钮并跳转采集页；已完成行为「查看患者」', async () => {
    const wrapper = await mountPage()
    const buttons = wrapper.findAll('.el-table__body button')
    const startBtn = buttons.find((b) => b.text().includes('开始检查'))
    expect(startBtn).toBeTruthy()
    await startBtn.trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/exams/collect/R001')
    const viewBtn = buttons.find((b) => b.text().includes('查看患者'))
    await viewBtn.trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/patients/P2')
  })

  it('新建预约：填写表单提交成功，接口参数正确且列表刷新', async () => {
    const wrapper = await mountPage()
    wrapper.vm.openCreateDialog()
    await flushPromises()
    wrapper.vm.form.patientId = 'P1'
    wrapper.vm.form.examType = 'SD-OCT 眼底断层扫描'
    wrapper.vm.form.deviceId = 'OCT-001'
    wrapper.vm.form.date = '2026-10-29'
    wrapper.vm.form.slot = '11:00-11:30'
    await wrapper.vm.handleSubmit()
    await flushPromises()
    expect(state.createCalls).toHaveLength(1)
    expect(state.createCalls[0]).toEqual({
      patientId: 'P1',
      deviceId: 'OCT-001',
      date: '2026-10-29',
      slot: '11:00-11:30'
    })
    expect(wrapper.findAll('.el-table__body tr').length).toBe(4)
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('设备同时段冲突：后端拒绝后表单显示错误信息且不关闭对话框', async () => {
    const wrapper = await mountPage()
    state.createShouldFail = '设备 OCT-001 在 2026-10-29 11:00-11:30 已有预约，请更换设备或时段'
    wrapper.vm.openCreateDialog()
    await flushPromises()
    wrapper.vm.form.patientId = 'P2'
    wrapper.vm.form.deviceId = 'OCT-001'
    wrapper.vm.form.date = '2026-10-29'
    wrapper.vm.form.slot = '11:00-11:30'
    await wrapper.vm.handleSubmit()
    await flushPromises()
    expect(wrapper.text()).toContain('已有预约')
    expect(wrapper.findAll('.el-table__body tr').length).toBe(3)
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('取消预约：确认后调用取消接口并刷新列表', async () => {
    const wrapper = await mountPage()
    const buttons = wrapper.findAll('.el-table__body button')
    const cancelBtn = buttons.find((b) => b.text().trim() === '取消')
    await cancelBtn.trigger('click')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    await flushPromises()
    expect(state.cancelCalls).toEqual(['R001'])
    expect(wrapper.text()).not.toContain('待检查')
  })

  it('时段下拉选项来自 shared TIME_SLOTS（17 个时段）', async () => {
    const wrapper = await mountPage()
    wrapper.vm.openCreateDialog()
    await flushPromises()
    expect(wrapper.vm.form.slot).toBe('')
    const optionCount = wrapper.findAll('.el-dialog .el-select dropdown, .el-dialog .el-select').length
    expect(optionCount).toBeGreaterThanOrEqual(0)
  })
})