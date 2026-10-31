import { todayStr } from './generators.js'
import { getReport, buildReport } from './reportsCore.js'
import { enhanceExams, getPatientExams } from './patientsQuery.js'

export function ensureMobileReport(db, examId, today = todayStr()) {
  const exam = (db.exams || []).find((e) => e.id === examId)
  if (!exam) {
    return { ok: false, message: '检查记录不存在' }
  }
  const patient = (db.patients || []).find((p) => p.id === exam.patientId)
  if (!patient) {
    return { ok: false, message: '患者数据异常' }
  }
  const stored = getReport(db, examId)
  return {
    ok: true,
    data: {
      report: stored || buildReport(exam, patient, today),
      generated: !stored,
      patient: {
        id: patient.id,
        name: patient.name,
        gender: patient.gender,
        age: patient.age,
        tags: patient.tags || []
      }
    }
  }
}

export function buildMetricSeries(exams) {
  const map = new Map()
  ;(exams || []).forEach((exam) => {
    ;(exam.metrics || []).forEach((metric) => {
      if (!map.has(metric.label)) {
        map.set(metric.label, { label: metric.label, unit: metric.unit, points: [] })
      }
      map.get(metric.label).points.push({
        date: exam.date,
        value: metric.value,
        trend: metric.trend,
        delta: metric.delta === undefined ? null : metric.delta
      })
    })
  })
  return [...map.values()].map((series) => ({
    ...series,
    points: series.points.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }))
}

export function buildMobilePatient(db, patientId, today = todayStr()) {
  const patient = (db.patients || []).find((p) => p.id === patientId)
  if (!patient) {
    return { ok: false, message: '患者不存在' }
  }
  const exams = enhanceExams(getPatientExams(db.exams, patientId), patient, today)
  return {
    ok: true,
    data: {
      patient: {
        id: patient.id,
        name: patient.name,
        gender: patient.gender,
        age: patient.age,
        region: patient.region,
        tags: patient.tags || [],
        status: patient.status,
        lastExamDate: patient.lastExamDate
      },
      series: buildMetricSeries(exams),
      exams: exams.map((exam) => ({
        id: exam.id,
        date: exam.date,
        type: exam.type,
        deviceId: exam.deviceId,
        doctor: exam.doctor,
        aiResult: exam.aiResult,
        conclusion: exam.conclusion,
        confidence: exam.confidence,
        trend: exam.trend,
        metrics: exam.metrics || []
      }))
    }
  }
}