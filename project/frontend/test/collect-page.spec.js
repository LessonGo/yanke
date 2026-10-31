import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  startResult: null,
  startError: null,
  completeCalls: [],
  completeResult: null,
  pushSpy: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'R001' } }),
  useRouter: () => ({ push: state.pushSpy })
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../src/services/dataService', () => ({
  dataService: {
    startReservation: (id) => {
      if (state.startError) {
        return Promise.reject(new Error(state.startError))
      }
      return Promise.resolve({ ...state.startResult, reservationId: id })
    },
    completeReservation: (id) => {
      state.completeCalls.push(id)
      return Promise.resolve({ ...state.completeResult, reservationId: id })
    }
  }
}))

import Collect from '../src/views/Collect.vue'
import { ElMessage } from 'element-plus'

const ElementPlus = (await import('element-plus')).default

function makeSession() {
  return {
    reservation: {
      id: 'R001',
      patientId: 'P1',
      patientName: '张建国',
      examType: 'SS-OCT 深度成像检查',
      deviceId: 'OCT-003',
      deviceName: 'SS-OCT 深度成像仪 01',
      date: '2026-10-28',
      slot: '09:00-09:30',
      status: '待检查'
    },
    patient: { id: 'P1', name: '张建国', gender: '男', age: 62, tags: ['青光眼'] },
    device: { id: 'OCT-003', name: 'SS-OCT 深度成像仪 01', type: 'SS-OCT 深度成像检查' },
    platform: 'SS-OCT',
    profile: {
      platform: 'SS-OCT',
      platformName: 'SS-OCT（扫频光源 OCT）',
      lightSource: '扫频激光器（VCSEL）',
      scanSpeed: '100 万次/秒',
      imagingDepth: '20 mm',
      scanAngle: '150° 超广角',
      axialResolution: '≤10 μm',
      scanDuration: '约 8 秒'
    }
  }
}

async function mountPage(props = {}) {
  const wrapper = mount(Collect, {
    props: { fast: true, ...props },
    global: { plugins: [ElementPlus] }
  })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
  return wrapper
}

describe('模拟数据采集流程页', () => {
  beforeEach(() => {
    state.startResult = makeSession()
    state.startError = null
    state.completeCalls = []
    state.completeResult = {
      examId: 'E202610280156',
      patientId: 'P1',
      patientName: '张建国',
      aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 94%）',
      conclusion: '视杯盘比增大，RNFL 厚度变薄，提示青光眼性视神经损害，建议完善视野检查并规律随访',
      doctor: '陈明'
    }
    state.pushSpy.mockClear()
  })

  it('加载预约信息：患者/设备/平台/参数面板正确渲染', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('张建国')
    expect(wrapper.text()).toContain('OCT-003')
    expect(wrapper.text()).toContain('青光眼')
    expect(wrapper.text()).toContain('100 万次/秒')
    expect(wrapper.text()).toContain('20 mm')
    expect(wrapper.text()).toContain('150° 超广角')
    expect(wrapper.vm.platform).toBe('SS-OCT')
  })

  it('开始采集（fast 模式）：进度走完、完成接口调用、结果卡片渲染', async () => {
    const wrapper = await mountPage()
    expect(wrapper.vm.done).toBe(false)
    wrapper.vm.startCollect()
    await new Promise((r) => setTimeout(r, 400))
    await flushPromises()
    await new Promise((r) => setTimeout(r, 100))
    await flushPromises()
    expect(wrapper.vm.progress).toBe(100)
    expect(wrapper.vm.done).toBe(true)
    expect(state.completeCalls).toEqual(['R001'])
    expect(wrapper.text()).toContain('E202610280156')
    expect(wrapper.text()).toContain('AI 初筛：检出青光眼杯盘比异常')
    expect(wrapper.text()).toContain('陈明')
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('完成后「查看患者时间线」跳转患者详情', async () => {
    const wrapper = await mountPage()
    wrapper.vm.startCollect()
    await new Promise((r) => setTimeout(r, 400))
    await flushPromises()
    await new Promise((r) => setTimeout(r, 100))
    await flushPromises()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('查看患者时间线'))
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/patients/P1')
  })

  it('平台可切换且参数面板联动（SS→SD）', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('扫频激光器（VCSEL）')
    const sdRadio = wrapper.findAll('.el-radio-button').find((b) => b.text().includes('SD-OCT'))
    await sdRadio.find('input').setValue()
    await flushPromises()
    expect(wrapper.vm.platform).toBe('SD-OCT')
    expect(wrapper.text()).toContain('8-10 万次/秒')
    expect(wrapper.text()).toContain('宽带近红外光源')
  })

  it('start 失败（预约已完成）：显示错误与返回按钮', async () => {
    state.startError = '预约状态为「已完成」，仅待检查状态可发起检查'
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('仅待检查状态可发起检查')
    const backBtn = wrapper.findAll('button').find((b) => b.text().includes('返回检查管理'))
    expect(backBtn).toBeTruthy()
    await backBtn.trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/exams')
  })
})