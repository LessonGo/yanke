import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  stats: null,
  patientDetail: null,
  readResult: null,
  reviewCalls: [],
  reviewResult: null,
  confirmedReport: null,
  readError: null
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
    getAiStats: () => Promise.resolve(state.stats),
    getPatients: () => Promise.resolve({ list: [], total: 0 }),
    getPatientDetail: () => Promise.resolve(state.patientDetail),
    aiRead: (examId) => {
      if (state.readError) {
        return Promise.reject(new Error(state.readError))
      }
      return Promise.resolve({ ...state.readResult, examId })
    },
    reviewReport: (examId, payload) => {
      state.reviewCalls.push({ examId, payload })
      return Promise.resolve({ ...state.readResult.report, ...state.reviewResult })
    }
  }
}))

vi.mock('../src/stores/auth', () => ({
  useAuthStore: () => ({ displayName: '陈明', role: 'doctor', roleName: '眼科医生' })
}))

import AiDiagnosis from '../src/views/AiDiagnosis.vue'
import { ElMessage } from 'element-plus'

const ElementPlus = (await import('element-plus')).default

function makeReport() {
  return {
    examId: 'E202610200001',
    patientId: 'P20260001',
    patientName: '张建国',
    examDate: '2026-10-20',
    examType: 'SD-OCT 眼底断层扫描',
    deviceId: 'OCT-001',
    createdAt: '2026-10-28',
    confidence: 94,
    aiConclusion: 'AI 初筛：检出青光眼杯盘比异常',
    suggestedDiagnosis: '青光眼（早期）',
    diagnosisOptions: ['青光眼（早期）', '青光眼（进展期）', '高眼压症'],
    lesions: [
      { disease: '青光眼', location: '右眼 视盘区', confidence: 94, box: { x: 0.58, y: 0.32, w: 0.24, h: 0.28 } }
    ],
    metrics: [{ label: 'RNFL 平均厚度', value: 88, unit: 'μm' }],
    trend: '减轻',
    status: '待复核',
    finalConclusion: '',
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: ''
  }
}

async function mountPage() {
  const wrapper = mount(AiDiagnosis, {
    props: { fast: true },
    global: { plugins: [ElementPlus] }
  })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('AI 读片工作台', () => {
  beforeEach(() => {
    state.stats = { todayReadCount: 6, avgReadSeconds: 3, diseaseCoverage: 5, reviewedCount: 4, totalReports: 8 }
    state.patientDetail = {
      patient: { id: 'P20260001', name: '张建国', tags: ['青光眼'] },
      exams: [
        { id: 'E202610200001', date: '2026-10-20', type: 'SD-OCT 眼底断层扫描' },
        { id: 'E202608120002', date: '2026-08-12', type: 'SD-OCT 眼底断层扫描' }
      ]
    }
    state.readResult = {
      report: makeReport(),
      exam: { id: 'E202610200001', date: '2026-10-20', type: 'SD-OCT 眼底断层扫描', deviceId: 'OCT-001' },
      patient: { id: 'P20260001', name: '张建国', gender: '男', age: 62, tags: ['青光眼'] },
      stages: [
        { name: '载入 3D 体数据', duration: 900 },
        { name: '层积分割', duration: 800 },
        { name: '病灶检测', duration: 800 },
        { name: '生成报告', duration: 500 }
      ],
      created: true
    }
    state.reviewCalls = []
    state.reviewResult = null
  })

  it('顶部统计条渲染四项指标（今日读片数/平均耗时3秒/病种覆盖/已签发）', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('.stat-card').length).toBe(4)
    expect(wrapper.text()).toContain('今日 AI 读片数')
    expect(wrapper.text()).toContain('平均读片耗时')
    expect(wrapper.text()).toContain('覆盖病种数')
    expect(wrapper.text()).toContain('已签发报告')
    expect(wrapper.text()).toContain('3')
  })

  it('选择患者后加载其检查记录并默认选中第一条', async () => {
    const wrapper = await mountPage()
    await wrapper.vm.handlePatientChange('P20260001')
    await flushPromises()
    expect(wrapper.vm.selectedExamId).toBe('E202610200001')
  })

  it('AI 读片（fast）：四阶段动画走完并渲染结构化报告', async () => {
    const wrapper = await mountPage()
    wrapper.vm.selectedPatientId = 'P20260001'
    await wrapper.vm.handlePatientChange('P20260001')
    await flushPromises()
    await wrapper.vm.handleRead()
    await flushPromises()
    expect(wrapper.vm.progress).toBe(100)
    expect(wrapper.vm.report).toBeTruthy()
    const text = wrapper.text()
    expect(text).toContain('AI 初筛：检出青光眼杯盘比异常')
    expect(text).toContain('青光眼（早期）')
    expect(text).toContain('RNFL 平均厚度')
    expect(text).toContain('右眼 视盘区')
    expect(text).toContain('置信度 94%')
    expect(wrapper.findAll('.lesion-box').length).toBe(1)
    expect(text).toContain('待医生复核')
  })

  it('确认签发：调用复核接口并展示签名与签发时间', async () => {
    const wrapper = await mountPage()
    wrapper.vm.selectedPatientId = 'P20260001'
    await wrapper.vm.handlePatientChange('P20260001')
    await flushPromises()
    await wrapper.vm.handleRead()
    await flushPromises()
    state.reviewResult = { status: '已签发', finalConclusion: '青光眼（早期）', reviewedBy: '陈明医生', reviewedAt: '2026-10-28 15:30:22' }
    await wrapper.vm.handleConfirm()
    await flushPromises()
    expect(state.reviewCalls).toHaveLength(1)
    expect(state.reviewCalls[0].payload.action).toBe('confirm')
    expect(state.reviewCalls[0].payload.reviewer).toBe('陈明医生')
    const text = wrapper.text()
    expect(text).toContain('已签发')
    expect(text).toContain('陈明医生')
    expect(text).toContain('2026-10-28 15:30:22')
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('修正后签发：未选结论时提示错误，选择后提交修正参数', async () => {
    const wrapper = await mountPage()
    wrapper.vm.selectedPatientId = 'P20260001'
    await wrapper.vm.handlePatientChange('P20260001')
    await flushPromises()
    await wrapper.vm.handleRead()
    await flushPromises()
    wrapper.vm.openAmendDialog()
    await flushPromises()
    await wrapper.vm.handleAmendSubmit()
    await flushPromises()
    expect(state.reviewCalls).toHaveLength(0)
    expect(wrapper.text()).toContain('请选择最终诊断结论')

    state.reviewResult = { status: '已签发', finalConclusion: '青光眼（进展期）', reviewNote: '建议视野检查', reviewedBy: '陈明医生', reviewedAt: '2026-10-28 16:00:00' }
    wrapper.vm.amendForm.finalConclusion = '青光眼（进展期）'
    wrapper.vm.amendForm.note = '建议视野检查'
    await wrapper.vm.handleAmendSubmit()
    await flushPromises()
    expect(state.reviewCalls).toHaveLength(1)
    expect(state.reviewCalls[0].payload).toMatchObject({
      action: 'amend',
      finalConclusion: '青光眼（进展期）',
      note: '建议视野检查',
      reviewer: '陈明医生'
    })
    expect(wrapper.text()).toContain('青光眼（进展期）')
  })

  it('读片接口失败时页面内展示错误且不渲染报告', async () => {
    const wrapper = await mountPage()
    wrapper.vm.selectedExamId = 'E-BAD'
    state.readError = '检查记录不存在'
    try {
      await wrapper.vm.handleRead()
      await flushPromises()
      expect(wrapper.vm.report).toBeNull()
      expect(wrapper.find('.read-error').exists()).toBe(true)
      expect(wrapper.text()).toContain('检查记录不存在')
    } finally {
      state.readError = null
    }
  })
})