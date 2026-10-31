import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'

const state = vi.hoisted(() => ({
  detail: null,
  pushSpy: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: state.detail ? state.detail.patient.id : 'P20260001' } }),
  useRouter: () => ({ push: state.pushSpy })
}))

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getPatientDetail: (id) => Promise.resolve(state.detail ? state.detail : { patient: null, exams: [] })
  }
}))

import PatientDetail from '../src/views/PatientDetail.vue'

describe('患者详情页', () => {
  beforeEach(() => {
    state.pushSpy.mockClear()
    state.detail = {
      patient: {
        id: 'P20260001',
        name: '张建国',
        gender: '男',
        age: 62,
        phone: '13800000001',
        region: '湖南',
        tags: ['青光眼', '黄斑水肿'],
        lastExamDate: '2026-10-20',
        status: '随访中',
        examCount: 3
      },
      exams: [
        { id: 'E1', patientId: 'P20260001', date: '2026-10-20', deviceId: 'OCT-001', type: 'SD-OCT 眼底断层扫描', aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 96%）', conclusion: '视杯盘比增大，RNFL 厚度变薄', doctor: '陈明', reportReady: true, confidence: 96, trend: '减轻', metrics: [{ label: 'RNFL 平均厚度', unit: 'μm', value: 88, delta: -3, deltaText: '-3μm', trend: '减轻' }] },
        { id: 'E2', patientId: 'P20260001', date: '2026-09-05', deviceId: 'OCT-003', type: 'SS-OCT 深度成像检查', aiResult: 'AI 初筛：未见明显异常（置信度 98%）', conclusion: '黄斑区结构清晰', doctor: '李文方', reportReady: true, confidence: 98, trend: '稳定', metrics: [{ label: 'RNFL 平均厚度', unit: 'μm', value: 91, delta: -2, deltaText: '-2μm', trend: '减轻' }] },
        { id: 'E3', patientId: 'P20260001', date: '2026-08-12', deviceId: 'OCT-001', type: 'SD-OCT 眼底断层扫描', aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 92%）', conclusion: '早期改变，建议随访', doctor: '周雅琴', reportReady: true, confidence: 92, trend: '稳定', metrics: [{ label: 'RNFL 平均厚度', unit: 'μm', value: 93, delta: null, deltaText: '', trend: '稳定' }] }
      ]
    }
  })

  it('渲染基本信息卡（姓名/年龄/手机号/地区/标签）', async () => {
    const wrapper = mount(PatientDetail, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('张建国')
    expect(text).toContain('62 岁')
    expect(text).toContain('13800000001')
    expect(text).toContain('湖南')
    expect(text).toContain('青光眼')
    expect(text).toContain('随访中')
  })

  it('检查时间线按日期倒序渲染 3 条记录（含 AI 初筛与结论）', async () => {
    const wrapper = mount(PatientDetail, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const items = wrapper.findAll('.el-timeline-item')
    expect(items.length).toBe(3)
    expect(items[0].text()).toContain('2026-10-20')
    expect(items[0].text()).toContain('AI 初筛')
    expect(items[0].text()).toContain('陈明')
    expect(wrapper.text()).toContain('检查时间线（3 次记录')
  })

  it('查看报告按钮跳转对应 AI 诊断报告页（接通 M5 入口）', async () => {
    const wrapper = mount(PatientDetail, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const buttons = wrapper.findAll('button').filter((b) => b.text().includes('查看报告'))
    expect(buttons.length).toBe(3)
    await buttons[0].trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/ai-diagnosis/report/E1?from=P20260001')
  })

  it('返回按钮跳转患者列表', async () => {
    const wrapper = mount(PatientDetail, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.find('.el-page-header__back').trigger('click')
    expect(state.pushSpy).toHaveBeenCalledWith('/patients')
  })

  it('渲染演化指标：最新记录显示定量指标（含较上次差值）与病情趋势标签', async () => {
    const wrapper = mount(PatientDetail, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const latest = wrapper.findAll('.el-timeline-item')[0]
    expect(latest.text()).toContain('RNFL 平均厚度 88μm')
    expect(latest.text()).toContain('较上次 -3μm')
    expect(latest.text()).toContain('病情减轻')
    expect(latest.find('.metric-减轻').exists()).toBe(true)
  })

  it('仅最新一条显示综合趋势标签，历史记录不显示', async () => {
    const wrapper = mount(PatientDetail, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const items = wrapper.findAll('.el-timeline-item')
    expect(items[0].text()).toContain('病情减轻')
    expect(items[1].text()).not.toContain('病情减轻')
    expect(items[1].text()).not.toContain('病情稳定')
    expect(items[2].text()).not.toContain('病情')
  })

  it('无 delta 的最旧记录不显示"较上次"字样', async () => {
    const wrapper = mount(PatientDetail, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const oldest = wrapper.findAll('.el-timeline-item')[2]
    expect(oldest.text()).toContain('RNFL 平均厚度 93μm')
    expect(oldest.text()).not.toContain('较上次')
  })
})