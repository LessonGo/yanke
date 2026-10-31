import { describe, it, expect } from 'vitest'
import {
  READ_STAGES,
  buildReport,
  ensureReport,
  reviewReport,
  getReport,
  getAiStats,
  diagnosisOptionsFor
} from '../../shared/reportsCore.js'
import { todayStr } from '../../shared/generators.js'

const exam = {
  id: 'E202610200001',
  patientId: 'P1',
  date: '2026-10-20',
  deviceId: 'OCT-001',
  deviceName: 'OCT-001',
  type: 'SD-OCT 眼底断层扫描',
  aiResult: 'AI 初筛：检出青光眼杯盘比异常（置信度 94%）',
  conclusion: '视杯盘比增大，RNFL 厚度变薄',
  doctor: '陈明',
  reportReady: true
}

const glaucomaPatient = { id: 'P1', name: '张建国', gender: '男', age: 62, tags: ['青光眼'], lastExamDate: '2026-10-20', examCount: 3 }
const healthyPatient = { id: 'P2', name: '李淑芬', gender: '女', age: 45, tags: [], lastExamDate: '2026-10-01', examCount: 1 }

function makeDb() {
  return { patients: [glaucomaPatient, healthyPatient], exams: [exam], reports: [] }
}

function makeTime(str) {
  const [d, t] = str.split(' ')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm, ss] = t.split(':').map(Number)
  return new Date(y, m - 1, day, hh, mm, ss)
}

describe('READ_STAGES 读片阶段', () => {
  it('四阶段且总时长 3 秒（验收要求 3 秒读片动画）', () => {
    expect(READ_STAGES.map((s) => s.name)).toEqual(['载入 3D 体数据', '层积分割', '病灶检测', '生成报告'])
    const total = READ_STAGES.reduce((s, x) => s + x.duration, 0)
    expect(total).toBe(3000)
  })
})

describe('buildReport 报告生成', () => {
  it('确定性：同一 today 两次生成完全一致', () => {
    const a = buildReport(exam, glaucomaPatient, '2026-10-28')
    const b = buildReport(exam, glaucomaPatient, '2026-10-28')
    expect(a).toEqual(b)
  })

  it('结构完整：病灶/指标/置信度/建议诊断/复核状态初始值', () => {
    const report = buildReport(exam, glaucomaPatient, '2026-10-28')
    expect(report.examId).toBe(exam.id)
    expect(report.patientName).toBe('张建国')
    expect(report.status).toBe('待复核')
    expect(report.finalConclusion).toBe('')
    expect(report.reviewedBy).toBe('')
    expect(report.lesions).toHaveLength(1)
    expect(report.lesions[0].disease).toBe('青光眼')
    expect(report.lesions[0].location).toMatch(/(双眼|右眼|左眼)\s*视盘区/)
    expect(report.lesions[0].confidence).toBeGreaterThanOrEqual(88)
    expect(report.lesions[0].confidence).toBeLessThanOrEqual(99)
    expect(report.metrics.length).toBeGreaterThanOrEqual(1)
    expect(report.metrics[0].label).toBe('RNFL 平均厚度')
    expect(report.suggestedDiagnosis).toBe('青光眼（早期）')
    expect(report.diagnosisOptions).toContain('青光眼（进展期）')
  })

  it('圈注坐标在 0-1 归一化范围且宽高为正', () => {
    const report = buildReport(exam, glaucomaPatient, '2026-10-28')
    report.lesions.forEach((l) => {
      expect(l.box.x).toBeGreaterThanOrEqual(0)
      expect(l.box.x).toBeLessThan(1)
      expect(l.box.y).toBeGreaterThanOrEqual(0)
      expect(l.box.y).toBeLessThan(1)
      expect(l.box.w).toBeGreaterThan(0)
      expect(l.box.h).toBeGreaterThan(0)
      expect(l.box.x + l.box.w).toBeLessThanOrEqual(1)
    })
  })

  it('跨日演化：不同 today 置信度或圈注坐标发生变化', () => {
    const day1 = buildReport(exam, glaucomaPatient, '2026-10-28')
    const day2 = buildReport(exam, glaucomaPatient, '2026-10-29')
    const changed =
      day1.confidence !== day2.confidence ||
      day1.lesions[0].box.x !== day2.lesions[0].box.x ||
      day1.metrics[0].value !== day2.metrics[0].value
    expect(changed).toBe(true)
  })

  it('健康患者无病灶且诊断为未见异常', () => {
    const exam2 = { ...exam, id: 'E202610010002', patientId: 'P2', aiResult: 'AI 初筛：未见明显异常（置信度 98%）' }
    const report = buildReport(exam2, healthyPatient, '2026-10-28')
    expect(report.lesions).toHaveLength(0)
    expect(report.suggestedDiagnosis).toBe('未见明显异常')
    expect(report.diagnosisOptions).toEqual(['未见明显异常', '轻度异常，建议随访', '建议进一步检查'])
  })

  it('多标签患者生成最多 2 个病灶（按病种圈注）', () => {
    const multi = { ...glaucomaPatient, tags: ['青光眼', '黄斑水肿'] }
    const report = buildReport(exam, multi, '2026-10-28')
    expect(report.lesions).toHaveLength(2)
    expect(report.lesions.map((l) => l.disease)).toEqual(['青光眼', '黄斑水肿'])
  })

  it('aiConclusion 已剥离原置信度文案（置信度独立字段展示）', () => {
    const report = buildReport(exam, glaucomaPatient, '2026-10-28')
    expect(report.aiConclusion).toBe('AI 初筛：检出青光眼杯盘比异常')
    expect(report.aiConclusion).not.toContain('置信度')
  })

  it('diagnosisOptionsFor 对未知病种返回默认选项', () => {
    expect(diagnosisOptionsFor(['未知病种'])).toContain('建议进一步检查')
    expect(diagnosisOptionsFor([])).toContain('未见明显异常')
  })
})

describe('ensureReport 幂等生成', () => {
  it('首次生成并写入 db，二次调用返回既有报告', () => {
    const db = makeDb()
    const first = ensureReport(db, exam, glaucomaPatient, '2026-10-28')
    expect(first.created).toBe(true)
    expect(first.db.reports).toHaveLength(1)
    const second = ensureReport(first.db, exam, glaucomaPatient, '2026-10-28')
    expect(second.created).toBe(false)
    expect(second.report).toEqual(first.report)
    expect(second.db.reports).toHaveLength(1)
  })
})

describe('reviewReport 医生复核', () => {
  function dbWithReport() {
    return ensureReport(makeDb(), exam, glaucomaPatient, '2026-10-28').db
  }

  it('确认签发：采用 AI 建议诊断并记录复核人与时间', () => {
    const db = dbWithReport()
    const result = reviewReport(db, exam.id, {
      action: 'confirm',
      reviewer: '陈明医生',
      now: makeTime('2026-10-28 15:30:22')
    })
    expect(result.ok).toBe(true)
    expect(result.report.status).toBe('已签发')
    expect(result.report.finalConclusion).toBe('青光眼（早期）')
    expect(result.report.reviewedBy).toBe('陈明医生')
    expect(result.report.reviewedAt).toBe('2026-10-28 15:30:22')
  })

  it('修正后签发：采用医生选择的结论并保留备注', () => {
    const db = dbWithReport()
    const result = reviewReport(db, exam.id, {
      action: 'amend',
      finalConclusion: '青光眼（进展期）',
      note: '建议加做视野检查，3 个月复查',
      reviewer: '李文方医生',
      now: makeTime('2026-10-28 16:05:00')
    })
    expect(result.ok).toBe(true)
    expect(result.report.finalConclusion).toBe('青光眼（进展期）')
    expect(result.report.reviewNote).toBe('建议加做视野检查，3 个月复查')
    expect(result.report.reviewedBy).toBe('李文方医生')
  })

  it('修正签发未选择结论时被拒绝', () => {
    const db = dbWithReport()
    const result = reviewReport(db, exam.id, { action: 'amend', finalConclusion: '   ' })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('需选择最终诊断结论')
  })

  it('已签发报告不可重复复核', () => {
    const db = dbWithReport()
    const first = reviewReport(db, exam.id, { action: 'confirm', reviewer: '陈明医生', now: makeTime('2026-10-28 15:30:00') })
    const second = reviewReport(first.db, exam.id, { action: 'amend', finalConclusion: '青光眼（进展期）' })
    expect(second.ok).toBe(false)
    expect(second.message).toContain('不可重复复核')
  })

  it('报告不存在时拒绝（未先读片）', () => {
    const result = reviewReport(makeDb(), 'E-NOT-EXIST', { action: 'confirm' })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('请先执行 AI 读片')
  })

  it('非法动作被拒绝', () => {
    const db = dbWithReport()
    expect(reviewReport(db, exam.id, { action: 'delete' }).ok).toBe(false)
  })
})

describe('getReport / getAiStats 查询统计', () => {
  it('getReport 命中与未命中', () => {
    const db = ensureReport(makeDb(), exam, glaucomaPatient, '2026-10-28').db
    expect(getReport(db, exam.id).examId).toBe(exam.id)
    expect(getReport(db, 'X')).toBeNull()
  })

  it('统计条：今日读片数/平均耗时3秒/病种覆盖/已签发', () => {
    let db = ensureReport(makeDb(), exam, glaucomaPatient, '2026-10-28').db
    db = reviewReport(db, exam.id, { action: 'confirm', reviewer: '陈明医生', now: makeTime('2026-10-28 15:00:00') }).db
    const stats = getAiStats(db, '2026-10-28')
    expect(stats.avgReadSeconds).toBe(3)
    expect(stats.diseaseCoverage).toBe(1)
    expect(stats.reviewedCount).toBe(1)
    expect(stats.totalReports).toBe(1)
    expect(stats.todayReadCount).toBe(1)
  })

  it('空报告库统计为 0', () => {
    const stats = getAiStats(makeDb(), '2026-10-28')
    expect(stats.todayReadCount).toBe(0)
    expect(stats.diseaseCoverage).toBe(0)
    expect(stats.totalReports).toBe(0)
  })
})