import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'db.json')

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20261028)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

const SURNAMES = ['张', '王', '李', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高', '梁']
const GIVEN_M = ['建国', '志强', '建军', '伟', '磊', '杰', '涛', '明浩', '晓东', '国华', '浩然', '文博', '子轩', '俊杰', '鹏飞', '立诚']
const GIVEN_F = ['淑芬', '丽娟', '桂英', '敏', '静', '艳', '娟', '秀英', '春梅', '凤凰', '雅琴', '雨桐', '欣然', '佳琪', '梦洁', '海燕']

const DISEASE_TAGS = [
  { name: '糖尿病视网膜病变', min: 45, max: 80 },
  { name: '青光眼', min: 35, max: 75 },
  { name: '黄斑水肿', min: 40, max: 80 },
  { name: '年龄相关性黄斑变性', min: 60, max: 85 },
  { name: '黄斑前膜', min: 50, max: 80 },
  { name: '视网膜脱离', min: 20, max: 70 },
  { name: '视神经病变', min: 30, max: 70 }
]
const HEALTHY_AGE = [25, 65]

const REGIONS = [
  { name: '湖南', count: 14 },
  { name: '广东', count: 7 },
  { name: '湖北', count: 5 },
  { name: '河南', count: 4 },
  { name: '四川', count: 3 },
  { name: '江苏', count: 3 },
  { name: '浙江', count: 2 },
  { name: '山东', count: 2 }
]

const DEVICE_IDS = ['OCT-001', 'OCT-002', 'OCT-003', 'OCT-004', 'OCT-005', 'OCT-006', 'OCT-007', 'OCT-008']
const DEVICE_WEIGHTS = [18, 14, 16, 12, 10, 12, 6, 4]
const DOCTORS = ['陈明', '李文方', '周雅琴']

const PHONE_PREFIX = ['138', '139', '136', '158', '187', '155', '176', '135']

function pickWeighted(items, weights) {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function randInt(min, max) {
  return min + Math.floor(rand() * (max - min + 1))
}

function dateStr(offsetDays) {
  const base = new Date(2026, 9, 28)
  const d = new Date(base.getTime() - offsetDays * 86400000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function pickGenderByTag(tags) {
  if (tags.includes('青光眼')) return rand() < 0.55 ? '女' : '男'
  return rand() < 0.48 ? '女' : '男'
}

const usedNames = new Set()
function genName(gender) {
  for (let i = 0; i < 50; i++) {
    const name = pick(SURNAMES) + pick(gender === '女' ? GIVEN_F : GIVEN_M)
    if (!usedNames.has(name)) {
      usedNames.add(name)
      return name
    }
  }
  return pick(SURNAMES) + gender + usedNames.size
}

function genTags() {
  const r = rand()
  if (r < 0.24) return []
  if (r < 0.78) return [pick(DISEASE_TAGS).name]
  const first = pick(DISEASE_TAGS).name
  let second = pick(DISEASE_TAGS).name
  let guard = 0
  while (second === first && guard < 10) {
    second = pick(DISEASE_TAGS).name
    guard++
  }
  return second === first ? [first] : [first, second]
}

function ageFromTags(tags) {
  if (!tags.length) return randInt(HEALTHY_AGE[0], HEALTHY_AGE[1])
  const ranges = tags.map((t) => DISEASE_TAGS.find((d) => d.name === t)).filter(Boolean)
  if (!ranges.length) return randInt(30, 75)
  const min = Math.max(...ranges.map((r) => r.min))
  const max = Math.min(...ranges.map((r) => r.max))
  return randInt(Math.min(min, max), Math.max(min, max))
}

function statusFromTags(tags) {
  const r = rand()
  if (!tags.length) {
    if (r < 0.7) return '已结案'
    if (r < 0.9) return '待复查'
    return '随访中'
  }
  if (r < 0.6) return '随访中'
  if (r < 0.9) return '待复查'
  return '已结案'
}

function conclusionFor(tags, isLatest) {
  if (!tags.length) {
    return isLatest
      ? '双眼黄斑区结构清晰，RNFL 厚度在正常范围，建议 12 个月后复查'
      : '双眼黄斑区及视盘结构未见明显异常'
  }
  const primary = tags[0]
  const map = {
    糖尿病视网膜病变: '双眼视网膜散在微血管瘤及点状出血，符合糖尿病视网膜病变（早期）表现，建议控制血糖并 3 个月复查',
    青光眼: '视杯盘比增大，RNFL 厚度变薄，提示青光眼性视神经损害，建议完善视野检查并规律随访',
    黄斑水肿: '黄斑中心凹厚度增加，视网膜层间囊样低反射腔，提示黄斑水肿，建议抗 VEGF 治疗评估',
    年龄相关性黄斑变性: '黄斑区玻璃膜疣及 RPE 改变，提示年龄相关性黄斑变性（干性），建议补充 AREDS 配方并随访',
    黄斑前膜: '黄斑区视网膜前高反射带，提示黄斑前膜形成，暂无牵拉征象，建议 6 个月复查',
    视网膜脱离: '周边视网膜浅脱离累及黄斑外区域，建议尽快行视网膜复位手术评估',
    视神经病变: '视盘水肿伴 RNFL 弥漫增厚，提示视神经病变，建议结合视野及全身检查'
  }
  return map[primary] || '眼底结构轻度异常，建议门诊随访'
}

function aiResultFor(tags) {
  if (!tags.length) return 'AI 初筛：未见明显异常（置信度 98%）'
  const primary = tags[0]
  const map = {
    糖尿病视网膜病变: 'AI 初筛：检出糖尿病视网膜病变病灶（置信度 96%）',
    青光眼: 'AI 初筛：检出青光眼杯盘比异常（置信度 94%）',
    黄斑水肿: 'AI 初筛：检出黄斑水肿区域（置信度 97%）',
    年龄相关性黄斑变性: 'AI 初筛：检出黄斑变性玻璃膜疣（置信度 93%）',
    黄斑前膜: 'AI 初筛：检出黄斑前膜（置信度 95%）',
    视网膜脱离: 'AI 初筛：检出视网膜脱离区域（置信度 98%）',
    视神经病变: 'AI 初筛：检出视神经纤维层异常（置信度 92%）'
  }
  return map[primary] || 'AI 初筛：检出轻度异常（置信度 90%）'
}

const regionPool = []
REGIONS.forEach((r) => {
  for (let i = 0; i < r.count; i++) regionPool.push(r.name)
})

const DEVICE_TYPE = {
  'OCT-001': 'SD-OCT 眼底断层扫描',
  'OCT-002': 'SD-OCT 眼底断层扫描',
  'OCT-003': 'SS-OCT 深度成像检查',
  'OCT-004': 'SS-OCT 深度成像检查',
  'OCT-005': 'SD-OCT 眼底断层扫描',
  'OCT-006': 'SS-OCT 深度成像检查',
  'OCT-007': 'SD-OCT 眼底断层扫描',
  'OCT-008': 'SD-OCT 眼底断层扫描'
}

const patients = []
const exams = []
let examSeq = 1

for (let i = 0; i < 40; i++) {
  const id = `P2026${String(i + 1).padStart(4, '0')}`
  const tags = genTags()
  const gender = pickGenderByTag(tags)
  const name = genName(gender)
  const age = ageFromTags(tags)
  const phone = `${pick(PHONE_PREFIX)}${String(Math.floor(rand() * 100000000)).padStart(8, '0')}`
  const region = regionPool[i] || '湖南'
  const status = statusFromTags(tags)

  const examCount = tags.length ? randInt(2, 6) : randInt(1, 2)
  const firstOffset = randInt(0, 42)
  const examDates = []
  let offset = firstOffset
  for (let k = 0; k < examCount; k++) {
    examDates.push(dateStr(offset))
    offset += randInt(7, 90)
  }
  const lastExamDate = examDates[0]

  examDates.forEach((date, k) => {
    const deviceId = pickWeighted(DEVICE_IDS, DEVICE_WEIGHTS)
    exams.push({
      id: `E${date.replace(/-/g, '')}${String(examSeq).padStart(4, '0')}`,
      patientId: id,
      date,
      deviceId,
      deviceName: deviceId,
      type: DEVICE_TYPE[deviceId],
      aiResult: aiResultFor(tags),
      conclusion: conclusionFor(tags, k === 0),
      doctor: pick(DOCTORS),
      reportReady: true
    })
    examSeq++
  })

  patients.push({ id, name, gender, age, phone, region, tags, lastExamDate, status, examCount })
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
db.patients = patients
db.exams = exams
const json = JSON.stringify(db, null, 2) + '\n'
fs.truncateSync(DB_PATH, 0)
fs.writeFileSync(DB_PATH, json, 'utf-8')
if (fs.readFileSync(DB_PATH, 'utf-8') !== json) {
  fs.truncateSync(DB_PATH, 0)
  fs.writeFileSync(DB_PATH, json, 'utf-8')
  console.error('写入校验不一致，已重写一次')
}

console.log(`生成完成：患者 ${patients.length} 名，检查记录 ${exams.length} 条`)
console.log(`区域分布：${REGIONS.map((r) => `${r.name}×${r.count}`).join('、')}`)
const tagCount = {}
patients.forEach((p) => p.tags.forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)))
console.log(`标签分布：${Object.entries(tagCount).map(([k, v]) => `${k}×${v}`).join('、')}`)
console.log(`无标签（健康筛查）：${patients.filter((p) => !p.tags.length).length} 名`)
console.log(`状态分布：随访中×${patients.filter((p) => p.status === '随访中').length}、待复查×${patients.filter((p) => p.status === '待复查').length}、已结案×${patients.filter((p) => p.status === '已结案').length}`)