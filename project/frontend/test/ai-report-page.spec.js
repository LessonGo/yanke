import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  readResult: null,
  readError: null,
  reviewCalls: [],
  reviewResult: null,
  pushSpy: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { examId: 'E202610200001' }, query: { from: 'P20260001' } }),
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
  useAuthStore: () => ({ displayName: '李文方', role: 'doctor', roleName: '眼科医生' })
}))

import AiReport from '../src/views/AiReport.vue'

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
    confidence: 95,
    aiConclusion: 'AI 初筛：检出黄斑水肿区域',
    suggestedDiagnosis: '黄斑水肿（需抗 VEGF 评估）',
    diagnosisOptions: ['黄斑水肿（需抗 VEGF 评估）', '黄斑水肿伴囊样改变', '黄斑区未见明显水肿'],
    lesions: [
      { disease: '黄斑水肿', location: '双眼 黄斑区', confidence: 95, box: { x: 0.34, y: 0.4, w: 0.3, h: 0.26 } }
    ],
    metrics: [{ label: '黄斑中心凹厚度', value: 271, unit: 'μm' }],
    trend: '减轻',
    status: '待复核',
    finalConclusion: '',
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: ''
  }
}

async function mountPage() {
  const wrapper = mount(AiReport, {
    props: { fast: true },
    global: { plugins: [ElementPlus] }
  })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 400))
  await flushPromises()
  return wrapper
}

describe('AI 诊断报告页（患者详情「查看报告」入口）', () => {
  beforeEach(() => {
    state.readError = null
    state.reviewCalls = []
    state.reviewResult = null
    state.pushSpy.mockClear()
    state.readResult = {
      report: makeReport(),
      exam: { id: 'E202610200001', date: '2026-10-20', type: 'SD-OCT 眼底断层扫描', deviceId: 'OCT-001' },
      patient: { id: 'P20260001', name: '张建国', gender: '男', age: 62, tags: ['黄斑水肿'] },
      stages: [
        { name: '载入 3D 体数据', duration: 900 },
        { name: '层积分割', duration: 800 },
        { name: '病灶检测', duration: 800 },
        { name: '生成报告', duration: 500 }
      ],
      created: true
    }
  })

  it('进入页面自动执行 AI 读片并展示报告（患者信息 + 病灶 + 圈注 + 指标）', async () => {
    const wrapper = await mountPage()
    expect(wrapper.vm.progress).toBe(100)
    const text = wrapper.text()
    expect(text).toContain('张建国')
    expect(text).toContain('黄斑水肿')
    expect(text).toContain('双眼 黄斑区')
    expect(text).toContain('黄斑中心凹厚度')
    expect(text).toContain('271μm')
    expect(text).toContain('置信度 95%')
    expect(wrapper.findAll('.lesion-box').length).toBe(1)
    expect(text).toContain('待医生复核')
  })

  it('修正后签发并展示签名样式', async () => {
    const wrapper = await mountPage()
    state.reviewResult = {
      status: '已签发',
      finalConclusion: '黄斑水肿伴囊样改变',
      reviewNote: '已安排抗 VEGF 治疗',
      reviewedBy: '李文方医生',
      reviewedAt: '2026-10-28 17:20:00'
    }
    wrapper.vm.openAmendDialog()
    wrapper.vm.amendForm.finalConclusion = '黄斑水肿伴囊样改变'
    wrapper.vm.amendForm.note = '已安排抗 VEGF 治疗'
    await wrapper.vm.handleAmendSubmit()
    await flushPromises()
    expect(state.reviewCalls[0].payload.action).toBe('amend')
    expect(state.reviewCalls[0].payload.reviewer).toBe('李文方医生')
    const text = wrapper.text()
    expect(text).toContain('已签发')
    expect(text).toContain('李文方医生')
    expect(text).toContain('已安排抗 VEGF 治疗')
    expect(wrapper.find('.sign-name').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('待医生复核')
  })

  it('读片失败（检查记录不存在）显示错误并可返回', async () => {
    state.readError = '检查记录不存在'
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('检查记录不存在')
    const btn = wrapper.findAll('button').find((b) => b.text().includes('返回'))
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    expect(state.pushSpy).toHaveBeenCalled()
  })

  it('「查看患者档案」跳转患者详情页', async () => {
    const wrapper = await mountPage()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('查看患者档案'))
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/patients/P20260001')
  })
})