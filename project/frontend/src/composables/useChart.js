import * as echarts from 'echarts'
import { onMounted, onUnmounted, ref, unref, watch } from 'vue'

function resolveOption(optionGetter) {
  if (typeof optionGetter === 'function') {
    return optionGetter()
  }
  return unref(optionGetter)
}

export function useChart(optionGetter) {
  const el = ref(null)
  let chart = null

  const getOption = () => resolveOption(optionGetter)

  const resize = () => {
    if (chart) {
      try {
        chart.resize()
      } catch (err) {
        console.error('[useChart] resize 失败:', err)
      }
    }
  }

  function showFallback(reason) {
    if (!el.value || el.value.querySelector('.chart-fallback')) {
      return
    }
    const tip = document.createElement('div')
    tip.className = 'chart-fallback'
    tip.textContent = `图表渲染受限：当前环境图形能力不足（${reason}）`
    tip.style.cssText =
      'height:100%;display:flex;align-items:center;justify-content:center;' +
      'color:#8fb0d6;font-size:13px;text-align:center;padding:12px;'
    el.value.appendChild(tip)
  }

  function createChart() {
    try {
      chart = echarts.init(el.value, null, { renderer: 'svg' })
    } catch (svgErr) {
      console.error('[useChart] SVG 渲染器初始化失败:', svgErr)
      chart = null
      showFallback(svgErr && svgErr.message ? svgErr.message : '初始化失败')
    }
  }

  const render = () => {
    if (!chart) {
      return
    }
    const option = getOption()
    if (!option) {
      return
    }
    try {
      chart.setOption(option, true)
    } catch (err) {
      console.error('[useChart] setOption 渲染失败:', err)
      showFallback(err && err.message ? err.message : '渲染失败')
    }
  }

  onMounted(() => {
    if (!el.value) {
      console.error('[useChart] 图表容器未挂载')
      return
    }
    createChart()
    render()
    window.addEventListener('resize', resize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    if (chart) {
      try {
        chart.dispose()
      } catch (err) {
        console.error('[useChart] dispose 失败:', err)
      }
      chart = null
    }
  })

  watch(optionGetter, render, { deep: true })

  return { el, resize }
}