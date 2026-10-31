import { describe, it, expect } from 'vitest'
import { ensureMobileReport, buildMobilePatient, buildMetricSeries } from '../../shared/mobileCore.js'

const exam = {
  id: 'E202610200001',
  patientId: 'P1',
  date: '2026-10-20',
  deviceId: 'OCT-001',
  type: 'SD-OCT 眼底断层扫描',
  aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 94%）',
  conclusion: '视杯盘比增大，RNFL 厚度变薄，提示青光眼性视神经损害',
  doctor: '陈明',
  reportReady: true
}
const exam2 = {
  id: 'E202608120002',
  patientId: 'P1',
  date: '2026-08-12',
  deviceId: 'OCT-001',
  type: 'SD-OCT 眼底断层扫描',
  aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 92%）',
  conclusion: '早期改变，建议随访',
  doctor: '李文方',
  reportReady: true
}

function makeDb() {
  return {
    patients: [{ id: 'P1', name: '张建国', gender: '男', age: 62, region: '湖南', tags: ['青光眼'], status: '随访中', lastExamDate: '2026-10-20' }],
    exams: [exam, exam2],
    reports: []
  }
}

describe('ensureMobileReport 移动端报告（只读）', () => {
  it('无存量报告时在内存生成，且不写入 db（H5 只读）', () => {
    const db = makeDb()
    const result = ensureMobileReport(db, exam.id, '2026-10-28')
    expect(result.ok).toBe(true)
    expect(result.data.generated).toBe(true)
    expect(result.data.report.examId).toBe(exam.id)
    expect(result.data.report.lesions.length).toBe(1)
    expect(result.data.report.patientName).toBe('张建国')
    expect(result.data.patient).toMatchObject({ gender: '男', age: 62 })
    expect(db.reports).toHaveLength(0)
  })

  it('已有存量报告时直接返回且 generated=false', () => {
    const db = makeDb()
    const first = ensureMobileReport(db, exam.id, '2026-10-28')
    const dbWithReport = { ...db, reports: [{ ...first.data.report, status: '已签发', reviewedBy: '陈明医生', reviewedAt: '2026-10-28 15:00:00' }] }
    const second = ensureMobileReport(dbWithReport, exam.id, '2026-10-28')
    expect(second.data.generated).toBe(false)
    expect(second.data.report.status).toBe('已签发')
    expect(second.data.report.reviewedBy).toBe('陈明医生')
  })

  it('检查记录不存在 / 患者数据异常时返回失败', () => {
    expect(ensureMobileReport(makeDb(), 'E-NOT-EXIST').ok).toBe(false)
    const broken = { ...makeDb(), patients: [] }
    expect(ensureMobileReport(broken, exam.id).ok).toBe(false)
  })
})

describe('buildMetricSeries 指标序列聚合', () => {
  it('按指标名分组、按日期升序、含单位', () => {
    const series = buildMetricSeries([
      { date: '2026-10-20', metrics: [{ label: 'RNFL 平均厚度', unit: 'μm', value: 88, trend: '减轻', delta: -3 }] },
      { date: '2026-08-12', metrics: [{ label: 'RNFL 平均厚度', unit: 'μm', value: 93, trend: '稳定', delta: null }] }
    ])
    expect(series).toHaveLength(1)
    expect(series[0].label).toBe('RNFL 平均厚度')
    expect(series[0].unit).toBe('μm')
    expect(series[0].points.map((p) => p.date)).toEqual(['2026-08-12', '2026-10-20'])
    expect(series[0].points.map((p) => p.value)).toEqual([93, 88])
  })

  it('多指标各成一条序列', () => {
    const series = buildMetricSeries([
      {
        date: '2026-10-20',
        metrics: [
          { label: 'RNFL 平均厚度', unit: 'μm', value: 88, trend: '减轻' },
          { label: '黄斑中心凹厚度', unit: 'μm', value: 271, trend: '减轻' }
        ]
      }
    ])
    expect(series.map((s) => s.label)).toEqual(['RNFL 平均厚度', '黄斑中心凹厚度'])
  })

  it('空数据返回空数组', () => {
    expect(buildMetricSeries([])).toEqual([])
  })
})

describe('buildMobilePatient 移动端健康趋势（只读）', () => {
  it('返回患者信息、指标序列与历次检查摘要（按日期倒序，含演化字段）', () => {
    const db = makeDb()
    const result = buildMobilePatient(db, 'P1', '2026-10-28')
    expect(result.ok).toBe(true)
    const { patient, series, exams } = result.data
    expect(patient.name).toBe('张建国')
    expect(patient.tags).toEqual(['青光眼'])
    expect(series.length).toBeGreaterThanOrEqual(1)
    expect(series[0].points.length).toBe(2)
    expect(exams.map((e) => e.date)).toEqual(['2026-10-20', '2026-08-12'])
    expect(exams[0].aiResult).toContain('青光眼')
    expect(exams[0].confidence).toBeGreaterThanOrEqual(88)
    expect(exams[0].metrics.length).toBeGreaterThanOrEqual(1)
    expect(exams[0].trend).toBe('减轻')
    expect(db.reports).toHaveLength(0)
  })

  it('患者不存在时返回失败', () => {
    expect(buildMobilePatient(makeDb(), 'P999').ok).toBe(false)
  })

  it('确定性：同日两次调用结果一致；跨日指标或置信度变化', () => {
    const db = makeDb()
    const a = buildMobilePatient(db, 'P1', '2026-10-28')
    const b = buildMobilePatient(db, 'P1', '2026-10-28')
    expect(a.data).toEqual(b.data)
    const c = buildMobilePatient(db, 'P1', '2026-10-30')
    expect(JSON.stringify(a.data)).not.toBe(JSON.stringify(c.data))
  })
})