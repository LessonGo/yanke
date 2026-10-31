import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({
  toDataURL: vi.fn(),
  successMsg: vi.fn(),
  warningMsg: vi.fn()
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: (...args) => state.toDataURL(...args)
  }
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ElMessage: { success: state.successMsg, error: vi.fn(), warning: state.warningMsg, info: vi.fn() }
  }
})

import QrCodeDialog from '../src/components/QrCodeDialog.vue'

const ElementPlus = (await import('element-plus')).default

async function mountDialog(props = {}) {
  const wrapper = mount(QrCodeDialog, {
    props: { visible: true, url: 'http://localhost:5173/m/report/E202610200001', title: '扫码查看检查报告（手机版）', ...props },
    global: { plugins: [ElementPlus] }
  })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  return wrapper
}

describe('二维码弹窗（桌面端扫码入口）', () => {
  beforeEach(() => {
    state.toDataURL.mockReset()
    state.toDataURL.mockResolvedValue('data:image/png;base64,FAKEQR')
    state.successMsg.mockClear()
    state.warningMsg.mockClear()
  })

  it('打开弹窗时按传入 URL 生成二维码并渲染图片', async () => {
    const wrapper = await mountDialog()
    expect(state.toDataURL).toHaveBeenCalled()
    expect(state.toDataURL.mock.calls[0][0]).toBe('http://localhost:5173/m/report/E202610200001')
    expect(wrapper.vm.dataUrl).toBe('data:image/png;base64,FAKEQR')
    const img = wrapper.find('.qr-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('data:image/png;base64,FAKEQR')
  })

  it('展示地址文本与同网络提示，标题正确', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.text()).toContain('http://localhost:5173/m/report/E202610200001')
    expect(wrapper.text()).toContain('手机需与本机处于同一网络')
    expect(wrapper.text()).toContain('扫码查看检查报告（手机版）')
  })

  it('URL 为空时报错且不生成二维码', async () => {
    const wrapper = await mountDialog({ url: '' })
    expect(wrapper.vm.error).toContain('链接地址为空')
    expect(state.toDataURL).not.toHaveBeenCalled()
  })

  it('二维码生成失败时展示错误信息', async () => {
    state.toDataURL.mockRejectedValue(new Error('编码失败'))
    const wrapper = await mountDialog()
    expect(wrapper.vm.error).toBe('编码失败')
  })

  it('复制链接：剪贴板可用时提示成功', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const wrapper = await mountDialog()
    await wrapper.vm.copyUrl()
    expect(writeText).toHaveBeenCalledWith('http://localhost:5173/m/report/E202610200001')
    expect(state.successMsg).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('复制链接：剪贴板不可用时降级提示手动复制', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const wrapper = await mountDialog()
    await wrapper.vm.copyUrl()
    expect(state.warningMsg).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('关闭弹窗时向父组件同步 visible（v-model）', async () => {
    const wrapper = await mountDialog()
    await wrapper.vm.$emit('update:visible', false)
    expect(wrapper.emitted('update:visible')).toBeTruthy()
    expect(wrapper.emitted('update:visible')[0]).toEqual([false])
  })
})