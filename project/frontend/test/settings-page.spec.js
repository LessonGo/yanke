import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  infoCalls: 0,
  resetCalls: [],
  resetError: null,
  confirmReject: false,
  successMsg: vi.fn(),
  errorMsg: vi.fn()
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ElMessage: { success: state.successMsg, error: state.errorMsg, info: vi.fn(), warning: vi.fn() },
    ElMessageBox: {
      confirm: () =>
        state.confirmReject ? Promise.reject(new Error('cancel')) : Promise.resolve('confirm')
    }
  }
})

vi.mock('../src/services/dataService', () => {
  const info = {
    appName: '眼科 OCT 智慧管理平台（演示系统）',
    version: '1.0.0',
    dataSource: 'JSON 文件库（shared/db.json）',
    frontend: 'Vue 3 + Element Plus + Vite + ECharts',
    backend: 'Node.js + Express（REST API）',
    serverTime: '2026-10-29 10:30:00',
    nodeVersion: 'v24.13.0',
    counts: { users: 4, patients: 40, exams: 155, reservations: 17, devices: 8, consumables: 14, reports: 2, stockLogs: 3 }
  }
  return {
    dataService: {
      getSystemInfo: () => {
        state.infoCalls += 1
        return Promise.resolve({ ...info })
      },
      getSystemUsers: () =>
        Promise.resolve([
          { username: 'admin', name: '系统管理员', role: 'admin', roleName: '管理员' },
          { username: 'doctor', name: '陈明医生', role: 'doctor', roleName: '眼科医生' },
          { username: 'nurse', name: '李婷护士', role: 'nurse', roleName: '眼科护士' },
          { username: 'tech', name: '王强技师', role: 'tech', roleName: '设备技师' }
        ]),
      getResetScopes: () =>
        Promise.resolve([
          { scope: 'patients', label: '患者与检查记录', description: '重置为 40 名患者 / 155 条检查记录', script: 'generate-patients.mjs' },
          { scope: 'assets', label: '设备与耗材', description: '重置设备与耗材', script: 'generate-assets.mjs' },
          { scope: 'reservations', label: '检查预约', description: '重置为 17 条初始预约', script: 'generate-reservations.mjs' },
          { scope: 'all', label: '全部演示数据', description: '重置全部并清空报告', script: null }
        ]),
      resetDemoData: (scope) => {
        state.resetCalls.push(scope)
        if (state.resetError) {
          return Promise.reject(new Error(state.resetError))
        }
        return Promise.resolve({ executed: ['患者与检查记录'], counts: info.counts })
      }
    }
  }
})

import Settings from '../src/views/Settings.vue'

const ElementPlus = (await import('element-plus')).default

async function mountPage() {
  const wrapper = mount(Settings, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('系统设置页（/settings，仅管理员可见）', () => {
  beforeEach(() => {
    state.infoCalls = 0
    state.resetCalls = []
    state.resetError = null
    state.confirmReject = false
    state.successMsg.mockClear()
    state.errorMsg.mockClear()
  })

  it('系统信息：应用名/版本/技术栈/服务器时间与 7 项数据规模', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('眼科 OCT 智慧管理平台（演示系统）')
    expect(text).toContain('1.0.0')
    expect(text).toContain('Vue 3 + Element Plus + Vite + ECharts')
    expect(text).toContain('JSON 文件库（shared/db.json）')
    expect(text).toContain('2026-10-29 10:30:00')
    expect(text).toContain('v24.13.0')
    expect(wrapper.findAll('.count-card').length).toBe(7)
    expect(text).toContain('后端服务在线')
  })

  it('账号与权限：四个演示账号 + 可见菜单数 + 权限矩阵', async () => {
    const wrapper = await mountPage()
    expect(wrapper.vm.users.length).toBe(4)
    expect(wrapper.vm.visibleMenuCount('admin')).toBe(7)
    expect(wrapper.vm.visibleMenuCount('doctor')).toBe(4)
    expect(wrapper.vm.visibleMenuCount('nurse')).toBe(3)
    expect(wrapper.vm.visibleMenuCount('tech')).toBe(3)
    const text = wrapper.text()
    expect(text).toContain('演示账号（4 个）')
    expect(text).toContain('admin')
    expect(text).toContain('123456')
    expect(text).toContain('角色权限矩阵')
  })

  it('数据维护：四个复位范围与当前数据规模', async () => {
    const wrapper = await mountPage()
    expect(wrapper.vm.resetScopes.length).toBe(4)
    expect(wrapper.findAll('.reset-item').length).toBe(4)
    const text = wrapper.text()
    expect(text).toContain('患者与检查记录')
    expect(text).toContain('全部演示数据')
    expect(text).toContain('数据复位将覆盖当前演示数据')
    expect(text).toContain('当前数据规模')
  })

  it('复位：确认后调用接口、提示成功并刷新系统信息', async () => {
    const wrapper = await mountPage()
    const callsBefore = state.infoCalls
    await wrapper.vm.handleReset({ scope: 'patients', label: '患者与检查记录', description: '重置为 40 名患者 / 155 条检查记录' })
    await flushPromises()
    expect(state.resetCalls).toEqual(['patients'])
    expect(state.successMsg).toHaveBeenCalled()
    expect(state.infoCalls).toBeGreaterThan(callsBefore)
    expect(wrapper.vm.resetting).toBe('')
  })

  it('复位：取消确认时不调用接口', async () => {
    const wrapper = await mountPage()
    state.confirmReject = true
    await wrapper.vm.handleReset({ scope: 'all', label: '全部演示数据', description: '重置全部' })
    await flushPromises()
    expect(state.resetCalls).toHaveLength(0)
    expect(wrapper.vm.resetting).toBe('')
  })

  it('复位失败时展示错误信息', async () => {
    const wrapper = await mountPage()
    state.resetError = '数据复位需后端服务在线（Mock 只读模式下不可用）'
    await wrapper.vm.handleReset({ scope: 'assets', label: '设备与耗材', description: '重置设备与耗材' })
    await flushPromises()
    expect(state.errorMsg).toHaveBeenCalled()
    expect(wrapper.vm.resetting).toBe('')
  })

  it('并发防护：复位进行中重复触发不会再次调用接口', async () => {
    const wrapper = await mountPage()
    wrapper.vm.resetting = 'patients'
    await wrapper.vm.handleReset({ scope: 'all', label: '全部演示数据', description: '重置全部' })
    await flushPromises()
    expect(state.resetCalls).toHaveLength(0)
  })

  it('关于：演示账号说明与验收脚本清单', async () => {
    const wrapper = await mountPage()
    wrapper.vm.activeTab = 'about'
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('项目定位')
    expect(text).toContain('admin / doctor / nurse / tech，口令均为 123456')
    expect(text).toContain('验收-01-登录与大屏.bat')
    expect(text).toContain('验收-07-系统设置.bat')
    expect(text).toContain('技术说明与限制')
  })
})