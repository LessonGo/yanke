import { todayStr } from './generators.js'

export function filterAndSortPatients(patients, { keyword = '', tag = '' } = {}) {
  const kw = String(keyword || '').trim()
  let list = patients || []
  if (kw) {
    list = list.filter(
      (p) => (p.name && p.name.includes(kw)) || (p.phone && p.phone.includes(kw))
    )
  }
  if (tag) {
    list = list.filter((p) => Array.isArray(p.tags) && p.tags.includes(tag))
  }
  return [...list].sort((a, b) => String(b.lastExamDate || '').localeCompare(String(a.lastExamDate || '')))
}

export function paginate(list, page = 1, pageSize = 10) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10))
  const start = (p - 1) * size
  return {
    list: (list || []).slice(start, start + size),
    total: (list || []).length,
    page: p,
    pageSize: size
  }
}

export function aggregateTags(patients) {
  const map = new Map()
  ;(patients || []).forEach((p) => {
    ;(Array.isArray(p.tags) ? p.tags : []).forEach((t) => {
      map.set(t, (map.get(t) || 0) + 1)
    })
  })
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getPatientExams(exams, patientId) {
  return (exams || [])
    .filter((e) => e.patientId === patientId)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}
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

const METRIC_DEFS = {
  青光眼: { label: 'RNFL 平均厚度', unit: 'μm', abnormal: 82, normal: 98, int: true },
  糖尿病视网膜病变: { label: '黄斑中心凹厚度', unit: 'μm', abnormal: 312, normal: 235, int: true },
  黄斑水肿: { label: '黄斑中心凹厚度', unit: 'μm', abnormal: 328, normal: 235, int: true },
  年龄相关性黄斑变性: { label: '玻璃膜疣计数', unit: '个', abnormal: 16, normal: 6, int: true },
  黄斑前膜: { label: '中心凹厚度', unit: 'μm', abnormal: 286, normal: 240, int: true },
  视网膜脱离: { label: '脱离范围', unit: 'PD', abnormal: 3.2, normal: 0.5, int: false },
  视神经病变: { label: 'RNFL 平均厚度', unit: 'μm', abnormal: 76, normal: 96, int: true }
}
const HEALTHY_METRIC = { label: 'RNFL 平均厚度', unit: 'μm', abnormal: 96, normal: 99, int: true }

export function enhanceExams(exams, patient, today = todayStr()) {
  const list = [...(exams || [])]
  if (!list.length) {
    return []
  }
  const tags = Array.isArray(patient && patient.tags) ? patient.tags : []
  const defs = []
  tags.forEach((t) => {
    if (METRIC_DEFS[t]) defs.push(METRIC_DEFS[t])
  })
  if (!defs.length) {
    defs.push(HEALTHY_METRIC)
  }

  const count = list.length
  const withValues = list.map((exam, i) => {
    const progress = count > 1 ? ((count - 1 - i) / (count - 1)) * 0.6 : 0.3
    const rand = mulberry32(hashString(`${today}#${exam.id}#m`))
    const values = defs.map((def) => {
      const jitter = (rand() * 2 - 1) * 1.2
      let v = def.abnormal + (def.normal - def.abnormal) * progress + jitter
      v = def.int === false ? Math.round(v * 10) / 10 : Math.round(v)
      return { def, v }
    })
    return { exam, values }
  })

  const confBase = tags.length ? 93 + (Math.abs(hashString(tags.join('|'))) % 5) : 98

  return withValues.map(({ exam, values }, i) => {
    const prev = i < withValues.length - 1 ? withValues[i + 1].values : null

    const metrics = values.map(({ def, v }, k) => {
      const dist = Math.abs(v - def.normal)
      let delta = null
      let deltaText = ''
      let trend = '稳定'
      if (prev) {
        const pv = prev[k].v
        delta = Math.round((v - pv) * 10) / 10
        deltaText = `${delta > 0 ? '+' : ''}${delta}${def.unit}`
        const pdist = Math.abs(pv - def.normal)
        const dd = dist - pdist
        trend = dd < -0.4 ? '减轻' : dd > 0.4 ? '进展' : '稳定'
      }
      return { label: def.label, unit: def.unit, value: v, delta, deltaText, trend }
    })

    const trendScore = metrics.reduce(
      (s, m) => s + (m.trend === '减轻' ? -1 : m.trend === '进展' ? 1 : 0),
      0
    )
    const trend = trendScore < 0 ? '减轻' : trendScore > 0 ? '进展' : '稳定'

    const confJitter = mulberry32(hashString(`${today}#${exam.id}#c`))() * 2 - 1
    const confidence = Math.max(88, Math.min(99, Math.round(confBase + confJitter)))

    let aiResult = exam.aiResult || ''
    if (/（置信度\s*\d+%）/.test(aiResult)) {
      aiResult = aiResult.replace(/（置信度\s*\d+%）/, `（置信度 ${confidence}%）`)
    } else {
      aiResult = `${aiResult}（置信度 ${confidence}%）`
    }

    return { ...exam, aiResult, confidence, metrics, trend }
  })
}