import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'

const state = vi.hoisted(() => ({
  patients: [],
  tags: [],
  calls: [],
  pushSpy: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: state.pushSpy })
}))

vi.mock('../src/services/dataService', () => ({
  dataService: {
    getPatients: (params) => {
      state.calls.push(params)
      const kw = (params.keyword || '').trim()
      let list = state.patients
      if (kw) list = list.filter((p) => p.name.includes(kw) || p.phone.includes(kw))
      if (params.tag) list = list.filter((p) => (p.tags || []).includes(params.tag))
      list = [...list].sort((a, b) => b.lastExamDate.localeCompare(a.lastExamDate))
      const page = params.page || 1
      const size = params.pageSize || 10
      return Promise.resolve({ list: list.slice((page - 1) * size, page * size), total: list.length, page, pageSize: size })
    },
    getPatientTags: () => Promise.resolve(state.tags)
  }
}))

import Patients from '../src/views/Patients.vue'

function makePatients(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `P2026${String(i + 1).padStart(4, '0')}`,
    name: `测试患者${i + 1}`,
    gender: i % 2 === 0 ? '男' : '女',
    age: 30 + (i % 50),
    phone: `1380000${String(i + 1).padStart(4, '0')}`,
    region: '湖南',
    tags: i < 3 ? ['青光眼'] : i < 5 ? ['糖尿病视网膜病变'] : [],
    lastExamDate: `2026-10-${String(((count - i) % 28) + 1).padStart(2, '0')}`,
    status: i % 3 === 0 ? '随访中' : i % 3 === 1 ? '待复查' : '已结案'
  }))
}

async function mountPage() {
  const wrapper = mount(Patients, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('患者档案列表页', () => {
  beforeEach(() => {
    state.patients = makePatients(25)
    state.tags = [
      { name: '青光眼', count: 3 },
      { name: '糖尿病视网膜病变', count: 2 }
    ]
    state.calls = []
    state.pushSpy.mockClear()
  })

  it('默认渲染第一页 10 条 + 总数 25 + 标签列/状态列', async () => {
    const wrapper = await mountPage()
    expect(state.calls[0]).toEqual({ page: 1, pageSize: 10, keyword: '', tag: '' })
    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows.length).toBe(10)
    expect(wrapper.text()).toContain('测试患者1')
    expect(wrapper.find('.el-pagination').exists()).toBe(true)
    expect(wrapper.text()).toContain('青光眼')
    expect(wrapper.text()).toContain('健康筛查')
    expect(wrapper.text()).toContain('随访中')
  })

  it('关键字查询：参数传递 keyword 并回到第一页', async () => {
    const wrapper = await mountPage()
    state.calls = []
    const input = wrapper.find('.filter-input input')
    await input.setValue('测试患者12')
    await wrapper.find('.filter-card .el-button--primary').trigger('click')
    await flushPromises()
    expect(state.calls[0]).toMatchObject({ keyword: '测试患者12', page: 1 })
    expect(wrapper.findAll('.el-table__body tr').length).toBe(1)
    expect(wrapper.text()).toContain('测试患者12')
  })

  it('标签筛选：filters.tag 设为青光眼后仅显示 3 名患者', async () => {
    const wrapper = await mountPage()
    state.calls = []
    wrapper.vm.filters.tag = '青光眼'
    await wrapper.vm.load(true)
    await flushPromises()
    expect(state.calls[0]).toMatchObject({ tag: '青光眼', page: 1 })
    expect(wrapper.findAll('.el-table__body tr').length).toBe(3)
    expect(wrapper.text()).toContain('青光眼')
  })

  it('关键字 + 标签组合筛选（交集）', async () => {
    const wrapper = await mountPage()
    state.calls = []
    wrapper.vm.filters.tag = '青光眼'
    wrapper.vm.filters.keyword = '测试患者2'
    await wrapper.vm.load(true)
    await flushPromises()
    expect(state.calls[0]).toMatchObject({ tag: '青光眼', keyword: '测试患者2' })
    expect(wrapper.findAll('.el-table__body tr').length).toBe(1)
    expect(wrapper.text()).toContain('测试患者2')
  })

  it('清空筛选（重置按钮）恢复全量数据', async () => {
    const wrapper = await mountPage()
    await wrapper.find('.filter-input input').setValue('测试患者12')
    await wrapper.find('.filter-card .el-button--primary').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.el-table__body tr').length).toBe(1)
    await wrapper.findAll('.filter-card .el-button')[1].trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.el-table__body tr').length).toBe(10)
    expect(wrapper.text()).toContain('测试患者1')
  })

  it('点击行跳转患者详情路由', async () => {
    const wrapper = await mountPage()
    await wrapper.find('.el-table__body tr').trigger('click')
    expect(state.pushSpy).toHaveBeenCalled()
    expect(state.pushSpy.mock.calls[0][0]).toMatch(/^\/patients\/P2026\d+$/)
  })

  it('分页切换第 2 页请求参数 page=2', async () => {
    const wrapper = await mountPage()
    state.calls = []
    const pagerNext = wrapper.find('.btn-next')
    await pagerNext.trigger('click')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    await flushPromises()
    expect(state.calls[0]).toMatchObject({ page: 2 })
    expect(wrapper.findAll('.el-table__body tr').length).toBe(10)
  })
})