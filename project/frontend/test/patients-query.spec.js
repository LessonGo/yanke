import { describe, it, expect } from 'vitest'
import {
  filterAndSortPatients,
  paginate,
  aggregateTags,
  getPatientExams
} from '../../shared/patientsQuery.js'

const patients = [
  { id: 'P1', name: '张建国', phone: '13800000001', tags: ['青光眼'], lastExamDate: '2026-10-20', status: '随访中' },
  { id: 'P2', name: '李淑芬', phone: '13900000002', tags: ['青光眼', '黄斑水肿'], lastExamDate: '2026-10-25', status: '待复查' },
  { id: 'P3', name: '王志强', phone: '13611112222', tags: [], lastExamDate: '2026-09-30', status: '已结案' },
  { id: 'P4', name: '刘丽娟', phone: '15800000004', tags: ['糖尿病视网膜病变'], lastExamDate: '2026-10-18', status: '随访中' }
]

describe('filterAndSortPatients 过滤与排序', () => {
  it('无筛选条件时返回全部患者并按最近检查日期倒序', () => {
    const result = filterAndSortPatients(patients, {})
    expect(result.map((p) => p.id)).toEqual(['P2', 'P1', 'P4', 'P3'])
  })

  it('按姓名关键字过滤（包含匹配）', () => {
    const result = filterAndSortPatients(patients, { keyword: '淑芬' })
    expect(result.map((p) => p.id)).toEqual(['P2'])
  })

  it('按手机号片段过滤', () => {
    const result = filterAndSortPatients(patients, { keyword: '1111' })
    expect(result.map((p) => p.id)).toEqual(['P3'])
  })

  it('按标签过滤（命中含该标签的所有患者）', () => {
    const result = filterAndSortPatients(patients, { tag: '青光眼' })
    expect(result.map((p) => p.id)).toEqual(['P2', 'P1'])
  })

  it('姓名关键字 + 标签组合筛选（交集）', () => {
    const result = filterAndSortPatients(patients, { keyword: '李', tag: '青光眼' })
    expect(result.map((p) => p.id)).toEqual(['P2'])
  })

  it('组合筛选无结果时返回空数组', () => {
    expect(filterAndSortPatients(patients, { keyword: '不存在', tag: '青光眼' })).toEqual([])
  })
})

describe('paginate 分页', () => {
  const list = Array.from({ length: 25 }, (_, i) => ({ id: i }))

  it('默认第一页 10 条', () => {
    const r = paginate(list)
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(10)
    expect(r.list.length).toBe(10)
    expect(r.total).toBe(25)
  })

  it('第二页取 10-20 条', () => {
    const r = paginate(list, 2, 10)
    expect(r.list[0].id).toBe(10)
    expect(r.list.length).toBe(10)
  })

  it('末页只取剩余条数', () => {
    const r = paginate(list, 3, 10)
    expect(r.list.length).toBe(5)
    expect(r.total).toBe(25)
  })

  it('非法页码回退为 1，pageSize 上限 100', () => {
    expect(paginate(list, 'abc').page).toBe(1)
    expect(paginate(list, 1, 999).pageSize).toBe(100)
    expect(paginate(list, -5).page).toBe(1)
  })
})

describe('aggregateTags 标签聚合', () => {
  it('聚合所有患者标签并按数量降序', () => {
    const result = aggregateTags(patients)
    expect(result[0]).toEqual({ name: '青光眼', count: 2 })
    expect(result.find((t) => t.name === '黄斑水肿').count).toBe(1)
    expect(result.find((t) => t.name === '糖尿病视网膜病变').count).toBe(1)
    expect(result.length).toBe(3)
  })

  it('空数据返回空数组', () => {
    expect(aggregateTags([])).toEqual([])
    expect(aggregateTags(null)).toEqual([])
  })
})

describe('getPatientExams 患者检查记录', () => {
  const exams = [
    { id: 'E1', patientId: 'P1', date: '2026-08-10' },
    { id: 'E2', patientId: 'P2', date: '2026-10-01' },
    { id: 'E3', patientId: 'P1', date: '2026-10-20' }
  ]

  it('只取该患者记录并按日期倒序', () => {
    const result = getPatientExams(exams, 'P1')
    expect(result.map((e) => e.id)).toEqual(['E3', 'E1'])
  })

  it('无记录返回空数组', () => {
    expect(getPatientExams(exams, 'P999')).toEqual([])
  })
})