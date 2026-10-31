import { todayStr } from './generators.js'
import { enhanceExams } from './patientsQuery.js'

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return h
}

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const READ_STAGES = [
  { name: '载入 3D 体数据', duration: 900 },
  { name: '层积分割', duration: 800 },
  { name: '病灶检测', duration: 800 },
  { name: '生成报告', duration: 500 }
]

const LESION_TEMPLATES = {
  青光眼: { location: '视盘区', box: { x: 0.58, y: 0.32, w: 0.24, h: 0.28 } },
  糖尿病视网膜病变: { location: '后极部视网膜', box: { x: 0.32, y: 0.3, w: 0.38, h: 0.34 } },
  黄斑水肿: { location: '黄斑区', box: { x: 0.34, y: 0.4, w: 0.3, h: 0.26 } },
  年龄相关性黄斑变性: { location: '黄斑区（玻璃膜疣）', box: { x: 0.36, y: 0.42, w: 0.28, h: 0.24 } },
  黄斑前膜: { location: '黄斑中心凹', box: { x: 0.38, y: 0.42, w: 0.26, h: 0.22 } },
  视网膜脱离: { location: '周边视网膜', box: { x: 0.12, y: 0.42, w: 0.28, h: 0.3 } },
  视神经病变: { location: '视神经纤维层', box: { x: 0.56, y: 0.28, w: 0.26, h: 0.3 } }
}

export const DIAGNOSIS_OPTIONS = {
  青光眼: ['青光眼（早期）', '青光眼（进展期）', '高眼压症', '青光眼疑似，建议随访'],
  糖尿病视网膜病变: ['糖尿病视网膜病变（非增殖期）', '糖尿病视网膜病变（增殖期）', '糖网筛查阴性', '建议转诊眼底专科'],
  黄斑水肿: ['黄斑水肿（需抗 VEGF 评估）', '黄斑水肿伴囊样改变', '黄斑区未见明显水肿'],
  年龄相关性黄斑变性: ['年龄相关性黄斑变性（干性）', '年龄相关性黄斑变性（湿性）', '玻璃膜疣，建议随访'],
  黄斑前膜: ['黄斑前膜（未见牵拉）', '黄斑前膜伴牵拉', '黄斑区未见明显前膜'],
  视网膜脱离: ['视网膜脱离（需手术评估）', '视网膜浅脱离，建议密切随访', '未见视网膜脱离'],
  视神经病变: ['视神经病变，建议视野检查', '视盘水肿，建议颅脑检查', '视神经未见明显异常']
}

export const DEFAULT_DIAGNOSIS_OPTIONS = ['未见明显异常', '轻度异常，建议随访', '建议进一步检查']

export function diagnosisOptionsFor(tags) {
  const primary = Array.isArray(tags) && tags.length ? tags[0] : ''
  return DIAGNOSIS_OPTIONS[primary] || DEFAULT_DIAGNOSIS_OPTIONS
}

function suggestedDiagnosisFor(tags) {
  const primary = Array.isArray(tags) && tags.length ? tags[0] : ''
  const options = DIAGNOSIS_OPTIONS[primary]
  return options ? options[0] : '未见明显异常'
}

export function getReport(db, examId) {
  return (db.reports || []).find((r) => r.examId === examId) || null
}

export function buildReport(exam, patient, today = todayStr()) {
  const enhanced = enhanceExams([exam], patient, today)[0]
  const tags = Array.isArray(patient.tags) ? patient.tags : []
  const rand = mulberry32(hashString(`${exam.id}#${today}#lesion`))
  const eyePrefix = () => {
    const r = rand()
    if (r < 0.45) return '双眼 '
    if (r < 0.72) return '右眼 '
    return '左眼 '
  }

  const lesions = tags
    .filter((t) => LESION_TEMPLATES[t])
    .slice(0, 2)
    .map((t) => {
      const tpl = LESION_TEMPLATES[t]
      const jitter = (rand() * 2 - 1) * 0.03
      return {
        disease: t,
        location: `${eyePrefix()}${tpl.location}`,
        confidence: enhanced.confidence,
        box: {
          x: Math.round((tpl.box.x + jitter) * 1000) / 1000,
          y: Math.round((tpl.box.y + jitter) * 1000) / 1000,
          w: tpl.box.w,
          h: tpl.box.h
        }
      }
    })

  return {
    examId: exam.id,
    patientId: patient.id,
    patientName: patient.name,
    examDate: exam.date,
    examType: exam.type,
    deviceId: exam.deviceId,
    createdAt: today,
    confidence: enhanced.confidence,
    aiConclusion: enhanced.aiResult.replace(/（置信度\s*\d+%）/, '').trim(),
    suggestedDiagnosis: suggestedDiagnosisFor(tags),
    diagnosisOptions: diagnosisOptionsFor(tags),
    lesions,
    metrics: enhanced.metrics.map((m) => ({ label: m.label, value: m.value, unit: m.unit })),
    trend: enhanced.trend,
    status: '待复核',
    finalConclusion: '',
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: ''
  }
}

export function ensureReport(db, exam, patient, today = todayStr()) {
  const existing = getReport(db, exam.id)
  if (existing) {
    return { ok: true, report: existing, db, created: false }
  }
  const report = buildReport(exam, patient, today)
  return {
    ok: true,
    report,
    db: { ...db, reports: [...(db.reports || []), report] },
    created: true
  }
}

export function reviewReport(db, examId, { action, finalConclusion, note = '', reviewer = '', now } = {}) {
  const list = db.reports || []
  const index = list.findIndex((r) => r.examId === examId)
  if (index === -1) {
    return { ok: false, message: '报告不存在，请先执行 AI 读片' }
  }
  const report = list[index]
  if (report.status === '已签发') {
    return { ok: false, message: '该报告已签发，不可重复复核' }
  }
  if (action !== 'confirm' && action !== 'amend') {
    return { ok: false, message: '复核动作无效' }
  }
  let conclusion = ''
  if (action === 'confirm') {
    conclusion = report.suggestedDiagnosis
  } else {
    conclusion = String(finalConclusion || '').trim()
    if (!conclusion) {
      return { ok: false, message: '修正签发需选择最终诊断结论' }
    }
  }
  const time = now || new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const reviewedAt = `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  const updated = {
    ...report,
    status: '已签发',
    finalConclusion: conclusion,
    reviewNote: String(note || '').trim(),
    reviewedBy: reviewer || '医生',
    reviewedAt
  }
  const reports = list.map((r) => (r.examId === examId ? updated : r))
  return { ok: true, report: updated, db: { ...db, reports } }
}

export function getAiStats(db, today = todayStr()) {
  const reports = db.reports || []
  const todayCount = reports.filter((r) => r.createdAt === today).length
  const diseaseSet = new Set()
  reports.forEach((r) => (r.lesions || []).forEach((l) => diseaseSet.add(l.disease)))
  const totalMs = READ_STAGES.reduce((s, x) => s + x.duration, 0)
  return {
    todayReadCount: todayCount,
    avgReadSeconds: Math.round(totalMs / 100) / 10,
    diseaseCoverage: diseaseSet.size,
    reviewedCount: reports.filter((r) => r.status === '已签发').length,
    totalReports: reports.length
  }
}