function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return h
}

export function todayStr(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function minuteSeed(salt = '') {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  return `${todayStr(now)}#${minutes}${salt}`
}

export function generatePatientFlow(seed = minuteSeed('flow')) {
  const rand = mulberry32(hashString(seed))
  const flow = []
  for (let h = 8; h <= 18; h++) {
    let base = 5
    if (h <= 11) base = 16 - (11 - h) * 2
    else if (h === 12) base = 7
    else if (h <= 16) base = 13 - (16 - h) * 2
    const count = Math.max(1, Math.round(base + rand() * 8))
    flow.push({ hour: `${String(h).padStart(2, '0')}:00`, count })
  }
  return flow
}

export function generateKpis(seed, patientFlowTotal) {
  const rand = mulberry32(hashString(`${seed}|kpi`))
  const monthRand = mulberry32(hashString(`${seed.split('#')[0]}|month`))
  return [
    { key: 'todayPatients', label: '今日就诊量', value: patientFlowTotal, unit: '例' },
    { key: 'monthPatients', label: '本月就诊量', value: Math.round(patientFlowTotal * 26 + monthRand() * 300 + 600), unit: '例' },
    { key: 'aiCoverage', label: 'AI 辅助诊断覆盖率', value: 95 + Math.round(rand() * 4), unit: '%' },
    { key: 'reportRate', label: '报告自动生成率', value: 97 + Math.round(rand() * 2), unit: '%' },
    { key: 'avgDuration', label: '平均诊疗时长', value: 7 + Math.round(rand() * 3), unit: '分钟' },
    { key: 'aiReadTime', label: 'AI 读片时间', value: 3, unit: '秒' }
  ]
}