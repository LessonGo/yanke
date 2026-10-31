import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const chartState = vi.hoisted(() => ({ calls: [] }))

vi.mock('echarts', () => ({
  init: () => ({
    setOption: (opt) => chartState.calls.push(opt),
    dispose: () => {},
    resize: () => {}
  }),
  registerMap: () => {}
}))

import RegionDistChart from '../src/components/dashboard/RegionDistChart.vue'

describe('区域分布图：geojson 名称规范化端到端链路', () => {
  afterEach(() => {
    chartState.calls.length = 0
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('加载 geojson 后，传给 ECharts 的 data 使用全称名称（visualMap 映射可生效的前提）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            { properties: { name: '湖南省' } },
            { properties: { name: '广东省' } },
            { properties: { name: '贵州省' } }
          ]
        })
      })
    )

    const wrapper = mount(RegionDistChart, {
      props: {
        regions: [
          { name: '湖南', value: 762 },
          { name: '广东', value: 534 },
          { name: '贵州', value: 128 }
        ]
      }
    })

    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()

    expect(chartState.calls.length).toBeGreaterThanOrEqual(1)
    const mapOption = chartState.calls.at(-1)
    expect(mapOption.series[0].type).toBe('map')
    const names = mapOption.series[0].data.map((d) => d.name)
    expect(names).toEqual(['湖南省', '广东省', '贵州省'])
    expect(mapOption.visualMap.inRange.color[0]).toBe('#12315c')
    expect(mapOption.visualMap.inRange.color.at(-1)).toBe('#ff7043')
    expect(mapOption.visualMap.max).toBe(762)
    expect(wrapper.emitted('mode-change')).toEqual([['map']])
  })

  it('geojson 加载失败时回退条形图模式且不使用全称', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down'))
    )

    const wrapper = mount(RegionDistChart, {
      props: { regions: [{ name: '湖南', value: 762 }] }
    })

    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()

    const barOption = chartState.calls.at(-1)
    expect(barOption.series[0].type).toBe('bar')
    expect(barOption.yAxis.data).toEqual(['湖南'])
    expect(wrapper.emitted('mode-change')).toEqual([['bar']])
  })
})