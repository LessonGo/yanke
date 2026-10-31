import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  reportResult: null,
  reportError: null,
  pushSpy: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { examId: 'E202610200001' } }),
  useRouter: () => ({ push: state.pushSpy })
}))

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getMobileReport: () => {
      if (state.reportError) {
        return Promise.reject(new Error(state.reportError))
      }
      return Promise.resolve(state.reportResult)
    }
  }
}))

import MobileReport from '../src/views/mobile/MobileReport.vue'

const ElementPlus = (await import('element-plus')).default

function makeReport(overrides = {}) {
  return {
    report: {
      examId: 'E202610200001',
      patientId: 'P20260013',
      patientName: '王桂英',
      examDate: '2026-10-07',
      examType: 'SD-OCT 眼底断层扫描',
      deviceId: 'OCT-001',
      createdAt: '2026-10-29',
      confidence: 95,
      aiConclusion: 'AI 初筛：检出青光眼杯盘比异常',
      suggestedDiagnosis: '青光眼（早期）',
      diagnosisOptions: ['青光眼（早期）'],
      lesions: [
        { disease: '青光眼', location: '双眼 视盘区', confidence: 95, box: { x: 0.58, y: 0.32, w: 0.24, h: 0.28 } },
        { disease: '黄斑水肿', location: '右眼 黄斑区', confidence: 95, box: { x: 0.34, y: 0.4, w: 0.3, h: 0.26 } }
      ],
      metrics: [
        { label: 'RNFL 平均厚度', value: 92, unit: 'μm' },
        { label: '黄斑中心凹厚度', value: 271, unit: 'μm' }
      ],
      trend: '减轻',
      status: '待复核',
      finalConclusion: '',
      reviewNote: '',
      reviewedBy: '',
      reviewedAt: '',
      ...overrides
    },
    patient: { id: 'P20260013', name: '王桂英', gender: '女', age: 58, tags: ['青光眼', '黄斑水肿'] }
  }
}

async function mountPage() {
  const wrapper = mount(MobileReport, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('移动端报告页（/m/report/:examId，免登录只读）', () => {
  beforeEach(() => {
    state.reportResult = makeReport()
    state.reportError = null
    state.pushSpy.mockClear()
  })

  it('渲染患者信息条（姓名/性别年龄/检查日期/检查类型）', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('王桂英')
    expect(text).toContain('女 · 58岁')
    expect(text).toContain('2026-10-07')
    expect(text).toContain('SD-OCT 眼底断层扫描')
    expect(text).toContain('手机版 · 只读')
  })

  it('渲染 AI 结论卡（初筛结论 + 置信度 + 趋势 + 建议诊断）', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('AI 初筛：检出青光眼杯盘比异常')
    expect(text).toContain('95%')
    expect(text).toContain('病情减轻')
    expect(text).toContain('青光眼（早期）')
  })

  it('渲染病灶圈注（SVG 框数量与病灶数一致）与病灶列表（病种/位置/置信度）', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('.lesion-box').length).toBe(2)
    const text = wrapper.text()
    expect(text).toContain('检出病灶（2 处）')
    expect(text).toContain('青光眼')
    expect(text).toContain('双眼 视盘区')
    expect(text).toContain('黄斑水肿')
    expect(text).toContain('右眼 黄斑区')
  })

  it('渲染定量指标与未签发提示（待复核水印 + 不显示医生签名）', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('RNFL 平均厚度')
    expect(text).toContain('92μm')
    expect(text).toContain('黄斑中心凹厚度')
    expect(text).toContain('待医生复核')
    expect(text).toContain('尚未完成医生复核')
    expect(wrapper.find('.sign-name').exists()).toBe(false)
  })

  it('已签发报告展示医生签名、签发时间、最终诊断与备注', async () => {
    state.reportResult = makeReport({
      status: '已签发',
      finalConclusion: '青光眼（进展期）',
      reviewedBy: '李文方医生',
      reviewedAt: '2026-10-29 09:20:00',
      reviewNote: '建议 3 个月复查'
    })
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('已签发')
    expect(text).toContain('李文方医生')
    expect(text).toContain('2026-10-29 09:20:00')
    expect(text).toContain('青光眼（进展期）')
    expect(text).toContain('建议 3 个月复查')
    expect(wrapper.find('.sign-name').exists()).toBe(true)
    expect(text).not.toContain('待医生复核')
  })

  it('无病灶报告显示「未检出病灶区域」', async () => {
    state.reportResult = makeReport({ lesions: [], aiConclusion: 'AI 初筛：未见明显异常' })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('未检出病灶区域')
    expect(wrapper.text()).toContain('未检出病灶，建议定期复查')
    expect(wrapper.findAll('.lesion-box').length).toBe(0)
  })

  it('点击「查看该患者健康趋势」跳转 /m/patient/:id', async () => {
    const wrapper = await mountPage()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('健康趋势'))
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/m/patient/P20260013')
  })

  it('加载失败时展示页面内错误与重试按钮', async () => {
    state.reportError = '检查记录不存在'
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('检查记录不存在')
    expect(wrapper.findAll('button').some((b) => b.text().includes('重试'))).toBe(true)
  })
})