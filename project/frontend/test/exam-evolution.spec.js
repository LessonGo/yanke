import { describe, it, expect } from 'vitest'
import { enhanceExams } from '../../shared/patientsQuery.js'

const glaucomaPatient = { id: 'P1', tags: ['青光眼'] }
const healthyPatient = { id: 'P2', tags: [] }

const threeExams = [
  { id: 'E3', patientId: 'P1', date: '2026-10-20', aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 94%）' },
  { id: 'E2', patientId: 'P1', date: '2026-09-05', aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 93%）' },
  { id: 'E1', patientId: 'P1', date: '2026-08-12', aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 92%）' }
]

describe('enhanceExams 检查结论随日期演化', () => {
  it('同一 today 两次调用结果完全一致（确定性）', () => {
    const a = enhanceExams(threeExams, glaucomaPatient, '2026-10-28')
    const b = enhanceExams(threeExams, glaucomaPatient, '2026-10-28')
    expect(a).toEqual(b)
  })

  it('不同 today 查看时 AI 置信度与指标数值发生变化', () => {
    const day1 = enhanceExams(threeExams, glaucomaPatient, '2026-10-28')
    const day2 = enhanceExams(threeExams, glaucomaPatient, '2026-10-29')
    const confChanged = day1.some((e, i) => e.confidence !== day2[i].confidence)
    const metricChanged = day1.some((e, i) =>
      e.metrics.some((m, k) => m.value !== day2[i].metrics[k].value)
    )
    expect(confChanged || metricChanged).toBe(true)
  })

  it('最新记录指标比最旧更接近正常值（治疗减轻叙事），最新综合趋势为减轻', () => {
    const result = enhanceExams(threeExams, glaucomaPatient, '2026-10-28')
    const def = result[0].metrics[0]
    const distLatest = Math.abs(result[0].metrics[0].value - 98)
    const distOldest = Math.abs(result[2].metrics[0].value - 98)
    expect(distLatest).toBeLessThan(distOldest)
    expect(result[0].trend).toBe('减轻')
    expect(def.label).toBe('RNFL 平均厚度')
    expect(def.unit).toBe('μm')
  })

  it('每条记录携带与上次的差值（delta/deltaText），最新一条也有（相对更早一次）', () => {
    const result = enhanceExams(threeExams, glaucomaPatient, '2026-10-28')
    expect(result[0].metrics[0].delta).not.toBeNull()
    expect(result[0].metrics[0].deltaText).toMatch(/^[+-]\d+(\.\d+)?μm$/)
    expect(result[2].metrics[0].delta).toBeNull()
  })

  it('aiResult 中的置信度被替换为当日演化值且与 confidence 字段一致', () => {
    const result = enhanceExams(threeExams, glaucomaPatient, '2026-10-28')
    result.forEach((exam) => {
      expect(exam.aiResult).toMatch(new RegExp(`（置信度 ${exam.confidence}%）`))
    })
  })

  it('无 aiResult 置信度字样时追加当日置信度', () => {
    const exams = [{ id: 'E9', patientId: 'P1', date: '2026-10-20', aiResult: 'AI 初筛：未见明显异常' }]
    const result = enhanceExams(exams, healthyPatient, '2026-10-28')
    expect(result[0].aiResult).toBe(`AI 初筛：未见明显异常（置信度 ${result[0].confidence}%）`)
  })

  it('无标签（健康）患者使用 RNFL 健康指标且趋势稳定', () => {
    const result = enhanceExams(threeExams, healthyPatient, '2026-10-28')
    expect(result[0].metrics[0].label).toBe('RNFL 平均厚度')
    expect(result[0].metrics[0].value).toBeGreaterThanOrEqual(90)
    expect(result[0].metrics[0].value).toBeLessThanOrEqual(101)
  })

  it('空检查记录返回空数组', () => {
    expect(enhanceExams([], glaucomaPatient, '2026-10-28')).toEqual([])
  })

  it('单条记录：无 delta、趋势为稳定、置信度在 88-99 区间', () => {
    const single = [threeExams[0]]
    const result = enhanceExams(single, glaucomaPatient, '2026-10-28')
    expect(result[0].metrics[0].delta).toBeNull()
    expect(result[0].trend).toBe('稳定')
    expect(result[0].confidence).toBeGreaterThanOrEqual(88)
    expect(result[0].confidence).toBeLessThanOrEqual(99)
  })
})