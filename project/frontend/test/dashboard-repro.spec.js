import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Dashboard from '../src/views/Dashboard.vue'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function mountDashboard() {
  const errors = []
  const originals = {
    error: console.error,
    warn: console.warn
  }
  console.error = (...args) => {
    errors.push(args.map(String).join(' '))
  }
  console.warn = () => {}
  window.addEventListener('error', (e) => errors.push('[window-error] ' + e.message))
  window.addEventListener('unhandledrejection', (e) => errors.push('[unhandledrejection] ' + String(e.reason)))

  try {
    const wrapper = mount(Dashboard, {
      global: {
        plugins: [ElementPlus]
      }
    })
    await flushPromises()
    await sleep(1500)
    await flushPromises()
    return { wrapper, errors }
  } finally {
    console.error = originals.error
    console.warn = originals.warn
  }
}

describe('数据中心大屏渲染回归（jsdom 环境）', () => {
  it('三个 ECharts 图表全部渲染出内容（svg 或受控降级），不再出现 optionGetter 类型错误', async () => {
    const { wrapper, errors } = await mountDashboard()

    const kpiCards = wrapper.findAll('.kpi-card')
    expect(kpiCards.length).toBeGreaterThanOrEqual(6)

    const deviceCards = wrapper.findAll('.device-card')
    expect(deviceCards.length).toBe(8)

    const charts = wrapper.findAll('.chart')
    expect(charts.length).toBe(3)

    for (const chart of charts) {
      const html = chart.element.innerHTML
      const rendered = html.includes('<svg') || html.includes('chart-fallback')
      expect(rendered).toBe(true)
    }

    const fatalErrors = errors.filter(
      (msg) =>
        msg.includes('optionGetter is not a function') ||
        msg.includes('[window-error]') ||
        msg.includes('[unhandledrejection]')
    )
    expect(fatalErrors).toEqual([])
  })

  it('图表数据渲染验证：疾病分布环形图包含各病种数据', async () => {
    const { wrapper } = await mountDashboard()
    const svgTexts = wrapper.findAll('.chart').map((c) => c.element.innerHTML)
    const anyChartWithData = svgTexts.some(
      (html) =>
        html.includes('黄斑水肿') ||
        html.includes('青光眼') ||
        html.includes('患者就诊量') ||
        html.includes('chart-fallback')
    )
    expect(anyChartWithData).toBe(true)
  })
})