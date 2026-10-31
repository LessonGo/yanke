import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  patientResult: null,
  patientError: null,
  pushSpy: vi.fn(),
  chartOptions: []
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'P20260013' } }),
  useRouter: () => ({ push: state.pushSpy })
}))

vi.mock('echarts', () => ({
  init: () => ({
    setOption: (opt) => state.chartOptions.push(opt),
    resize: () => {},
    dispose: () => {}
  })
}))

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getMobilePatient: () => {
      if (state.patientError) {
        return Promise.reject(new Error(state.patientError))
      }
      return Promise.resolve(state.patientResult)
    }
  }
}))

import MobileTrend from '../src/views/mobile/MobileTrend.vue'

const ElementPlus = (await import('element-plus')).default

function makeData() {
  return {
    patient: {
      id: 'P20260013',
      name: '王桂英',
      gender: '女',
      age: 58,
      region: '湖南',
      tags: ['青光眼', '黄斑水肿'],
      status: '随访中',
      lastExamDate: '2026-10-07'
    },
    series: [
      {
        label: 'RNFL 平均厚度',
        unit: 'μm',
        points: [
          { date: '2026-07-17', value: 95, trend: '稳定', delta: null },
          { date: '2026-08-20', value: 94, trend: '稳定', delta: -1 },
          { date: '2026-10-07', value: 92, trend: '减轻', delta: -2 }
        ]
      },
      {
        label: '黄斑中心凹厚度',
        unit: 'μm',
        points: [
          { date: '2026-08-20', value: 285, trend: '稳定', delta: null },
          { date: '2026-10-07', value: 271, trend: '减轻', delta: -14 }
        ]
      }
    ],
    exams: [
      {
        id: 'E202610070053',
        date: '2026-10-07',
        type: 'SD-OCT 眼底断层扫描',
        deviceId: 'OCT-001',
        doctor: '陈明',
        aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 95%）',
        conclusion: '视杯盘比增大，RNFL 厚度变薄',
        confidence: 95,
        trend: '减轻',
        metrics: [{ label: 'RNFL 平均厚度', value: 92, unit: 'μm' }]
      },
      {
        id: 'E202608200054',
        date: '2026-08-20',
        type: 'SS-OCT 深度成像检查',
        deviceId: 'OCT-003',
        doctor: '李文方',
        aiResult: 'AI 初筛：检出黄斑水肿区域（置信度 96%）',
        conclusion: '黄斑中心凹厚度增加，提示黄斑水肿',
        confidence: 96,
        trend: '稳定',
        metrics: []
      }
    ]
  }
}

async function mountPage() {
  state.chartOptions = []
  const wrapper = mount(MobileTrend, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
  return wrapper
}

describe('移动端健康趋势页（/m/patient/:id，免登录只读）', () => {
  beforeEach(() => {
    state.patientResult = makeData()
    state.patientError = null
    state.pushSpy.mockClear()
  })

  it('渲染患者信息（姓名/性别年龄/状态/标签/最近检查）', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('王桂英')
    expect(text).toContain('女 · 58岁')
    expect(text).toContain('随访中')
    expect(text).toContain('青光眼')
    expect(text).toContain('黄斑水肿')
    expect(text).toContain('最近检查 2026-10-07')
  })

  it('指标趋势：按指标生成图表并展示最新值', async () => {
    const wrapper = await mountPage()
    expect(state.chartOptions.length).toBe(2)
    const rnfl = state.chartOptions.find((o) => o.series[0].data.length === 3)
    expect(rnfl).toBeTruthy()
    expect(rnfl.xAxis.data).toEqual(['07-17', '08-20', '10-07'])
    expect(rnfl.series[0].data).toEqual([95, 94, 92])
    const text = wrapper.text()
    expect(text).toContain('RNFL 平均厚度')
    expect(text).toContain('92μm')
    expect(text).toContain('271μm')
    expect(text).toContain('定量指标趋势（近 3 次检查）')
  })

  it('历次检查结论摘要（日期/AI 结论/医生结论/医生/置信度）', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('历次检查结论（2 次）')
    expect(text).toContain('2026-10-07')
    expect(text).toContain('AI 初筛：检出青光眼杯盘比异常')
    expect(text).toContain('视杯盘比增大')
    expect(text).toContain('陈明')
    expect(text).toContain('2026-08-20')
    expect(text).toContain('置信度 96%')
  })

  it('点击某条检查跳转对应的移动端报告页', async () => {
    const wrapper = await mountPage()
    const items = wrapper.findAll('.exam-item')
    expect(items.length).toBe(2)
    await items[0].trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/m/report/E202610070053')
  })

  it('加载失败时展示页面内错误与重试', async () => {
    state.patientError = '患者不存在'
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('患者不存在')
    expect(wrapper.findAll('button').some((b) => b.text().includes('重试'))).toBe(true)
  })

  it('无指标数据时显示空提示', async () => {
    state.patientResult = { ...makeData(), series: [] }
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('暂无可展示的指标数据')
    expect(state.chartOptions.length).toBe(0)
  })
})