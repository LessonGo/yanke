export const DEVICE_TYPE = {
  'OCT-001': 'SD-OCT 眼底断层扫描',
  'OCT-002': 'SD-OCT 眼底断层扫描',
  'OCT-003': 'SS-OCT 深度成像检查',
  'OCT-004': 'SS-OCT 深度成像检查',
  'OCT-005': 'SD-OCT 眼底断层扫描',
  'OCT-006': 'SS-OCT 深度成像检查',
  'OCT-007': 'SD-OCT 眼底断层扫描',
  'OCT-008': 'SD-OCT 眼底断层扫描'
}

export const EXAM_TYPES = ['SD-OCT 眼底断层扫描', 'SS-OCT 深度成像检查']

export const DOCTORS = ['陈明', '李文方', '周雅琴']

export const PLATFORM_PROFILES = {
  'SD-OCT': {
    platform: 'SD-OCT',
    platformName: 'SD-OCT（谱域 OCT）',
    lightSource: '宽带近红外光源',
    scanSpeed: '8-10 万次/秒',
    imagingDepth: '6 mm',
    scanAngle: '55°',
    axialResolution: '≤5 μm',
    scanDuration: '约 10 秒'
  },
  'SS-OCT': {
    platform: 'SS-OCT',
    platformName: 'SS-OCT（扫频光源 OCT）',
    lightSource: '扫频激光器（VCSEL）',
    scanSpeed: '100 万次/秒',
    imagingDepth: '20 mm',
    scanAngle: '150° 超广角',
    axialResolution: '≤10 μm',
    scanDuration: '约 8 秒'
  }
}

export function devicePlatform(deviceId) {
  const type = DEVICE_TYPE[deviceId]
  return type ? type.split(' ')[0] : null
}

export function aiResultFor(tags) {
  if (!tags || !tags.length) return 'AI 初筛：未见明显异常（置信度 98%）'
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

export function conclusionFor(tags, isLatest) {
  if (!tags || !tags.length) {
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