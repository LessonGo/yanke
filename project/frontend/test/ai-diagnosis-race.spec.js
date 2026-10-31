import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  readCalls: [],
  readDelay: 0,
  readError: null,
  readResult: null
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }
})

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getAiStats: () => Promise.resolve({ todayReadCount: 0, avgReadSeconds: 3, diseaseCoverage: 0, reviewedCount: 0, totalReports: 0 }),
    getPatients: () => Promise.resolve({ list: [], total: 0 }),
    getPatientDetail: () =>
      Promise.resolve({
        patient: { id: 'P1', name: '张建国', tags: ['青光眼'] },
        exams: [{ id: 'E1', date: '2026-10-20', type: 'SD-OCT 眼底断层扫描' }]
      }),
    aiRead: (examId) => {
      state.readCalls.push(examId)
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (state.readError) {
            reject(new Error(state.readError))
          } else {
            resolve({ ...state.readResult, examId })
          }
        }, state.readDelay)
      })
    },
    reviewReport: () => Promise.resolve({})
  }
}))

vi.mock('../src/stores/auth', () => ({
  useAuthStore: () => ({ displayName: '陈明', role: 'doctor', roleName: '眼科医生' })
}))

import AiDiagnosis from '../src/views/AiDiagnosis.vue'

const ElementPlus = (await import('element-plus')).default

function makeResult() {
  return {
    report: {
      examId: 'E1',
      patientId: 'P1',
      patientName: '张建国',
      examDate: '2026-10-20',
      examType: 'SD-OCT 眼底断层扫描',
      deviceId: 'OCT-001',
      createdAt: '2026-10-28',
      confidence: 94,
      aiConclusion: 'AI 初筛：检出青光眼杯盘比异常',
      suggestedDiagnosis: '青光眼（早期）',
      diagnosisOptions: ['青光眼（早期）', '青光眼（进展期）'],
      lesions: [{ disease: '青光眼', location: '双眼 视盘区', confidence: 94, box: { x: 0.58, y: 0.32, w: 0.24, h: 0.28 } }],
      metrics: [{ label: 'RNFL 平均厚度', value: 88, unit: 'μm' }],
      trend: '减轻',
      status: '待复核',
      finalConclusion: '',
      reviewNote: '',
      reviewedBy: '',
      reviewedAt: ''
    },
    exam: { id: 'E1', date: '2026-10-20', type: 'SD-OCT 眼底断层扫描', deviceId: 'OCT-001' },
    patient: { id: 'P1', name: '张建国', gender: '男', age: 62, tags: ['青光眼'] },
    stages: [
      { name: '载入 3D 体数据', duration: 900 },
      { name: '层积分割', duration: 800 },
      { name: '病灶检测', duration: 800 },
      { name: '生成报告', duration: 500 }
    ],
    created: true
  }
}

async function mountPage(props = { fast: true }) {
  const wrapper = mount(AiDiagnosis, { props, global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  await wrapper.vm.handlePatientChange('P1')
  await flushPromises()
  return wrapper
}

describe('AI 读片：并发与状态防护回归', () => {
  beforeEach(() => {
    state.readCalls = []
    state.readDelay = 0
    state.readError = null
    state.readResult = makeResult()
  })

  it('网络等待期连续点击「AI 读片」只触发一次读片（防竞态覆盖）', async () => {
    state.readDelay = 200
    const wrapper = await mountPage()
    expect(wrapper.vm.selectedExamId).toBe('E1')
    const p1 = wrapper.vm.handleRead()
    const p2 = wrapper.vm.handleRead()
    const p3 = wrapper.vm.handleRead()
    await Promise.all([p1, p2, p3])
    await flushPromises()
    expect(state.readCalls.length).toBe(1)
    expect(wrapper.vm.report).toBeTruthy()
  })

  it('点击瞬间即进入读片状态（按钮立即 loading，提供即时反馈）', async () => {
    state.readDelay = 150
    const wrapper = await mountPage()
    const p = wrapper.vm.handleRead()
    await Promise.resolve()
    expect(wrapper.vm.reading).toBe(true)
    const btn = wrapper.findAll('button').find((b) => b.text().includes('AI 读片') || b.attributes('class')?.includes('is-loading'))
    expect(btn).toBeTruthy()
    await p
    await flushPromises()
    expect(wrapper.vm.reading).toBe(false)
  })

  it('读片失败时页面内展示可读错误（不再只有一闪而过的消息）', async () => {
    state.readError = '检查记录不存在'
    const wrapper = await mountPage()
    await wrapper.vm.handleRead()
    await flushPromises()
    expect(wrapper.find('.read-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('检查记录不存在')
    expect(wrapper.vm.report).toBeNull()
    expect(wrapper.vm.reading).toBe(false)
  })

  it('默认（非 fast）读片动画持续约 3 秒，不会被瞬间跳过', async () => {
    const wrapper = await mountPage({})
    const t0 = Date.now()
    let sawIntermediate = false
    const watcher = setInterval(() => {
      if (wrapper.vm.progress > 0 && wrapper.vm.progress < 100) sawIntermediate = true
    }, 100)
    await wrapper.vm.handleRead()
    clearInterval(watcher)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(2500)
    expect(sawIntermediate).toBe(true)
    expect(wrapper.vm.progress).toBe(100)
    expect(wrapper.vm.report).toBeTruthy()
  }, 30000)

  it('读片成功后报告完整渲染，且再次读片不会让报告区长时间空白（reading 期显示进行中）', async () => {
    state.readDelay = 50
    const wrapper = await mountPage()
    await wrapper.vm.handleRead()
    await flushPromises()
    expect(wrapper.findAll('.lesion-box').length).toBe(1)
    expect(wrapper.text()).toContain('青光眼（早期）')
    const p = wrapper.vm.handleRead()
    await Promise.resolve()
    expect(wrapper.find('.read-pending').exists() || wrapper.vm.reading).toBe(true)
    await p
    await flushPromises()
    expect(wrapper.vm.report).toBeTruthy()
    expect(wrapper.findAll('.lesion-box').length).toBe(1)
  })
})