<template>
  <div ref="el" class="chart"></div>
</template>

<script setup>
import * as echarts from 'echarts'
import { computed, onMounted, ref } from 'vue'
import { useChart } from '../../composables/useChart'
import { matchRegionNames } from '../../utils/regionName'

const GEOJSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'

const props = defineProps({
  regions: { type: Array, default: () => [] }
})

const emit = defineEmits(['mode-change'])

const mode = ref('bar')
const featureNames = ref([])

const mappedRegions = computed(() => matchRegionNames(props.regions, featureNames.value))

const maxValue = computed(() => Math.max(...props.regions.map((item) => item.value), 1))

const option = computed(() => {
  if (mode.value === 'map') {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(12, 32, 60, 0.9)',
        borderColor: 'rgba(64, 120, 192, 0.5)',
        textStyle: { color: '#dce8f7' },
        formatter: '{b}<br/>筛查患者 {c} 例'
      },
      visualMap: {
        min: 0,
        max: maxValue.value,
        left: 12,
        bottom: 12,
        text: ['热力高', '热力低'],
        textStyle: { color: '#8fb0d6', fontSize: 11 },
        inRange: { color: ['#12315c', '#1a6fb5', '#28c8c8', '#ffd66b', '#ff7043'] },
        calculable: false
      },
      series: [
        {
          name: '患者区域分布',
          type: 'map',
          map: 'china',
          roam: false,
          itemStyle: { areaColor: '#0f2a4d', borderColor: 'rgba(120, 180, 255, 0.55)' },
          emphasis: {
            label: { show: true, color: '#0d2140', fontSize: 11, fontWeight: 600 },
            itemStyle: { areaColor: '#e3f6ff', borderColor: '#ffffff', borderWidth: 2 }
          },
          label: { show: false },
          data: mappedRegions.value
        }
      ]
    }
  }
  const sorted = [...props.regions].sort((a, b) => b.value - a.value)
  const topMax = sorted.length ? sorted[0].value : 1
  const paletteStops = ['#1a6fb5', '#28c8c8', '#ffd66b', '#ff7043']
  function valueColor(value) {
    const ratio = Math.max(0, Math.min(1, value / (topMax || 1)))
    const seg = ratio * (paletteStops.length - 1)
    const i = Math.min(paletteStops.length - 2, Math.floor(seg))
    const t = seg - i
    const parse = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
    const from = parse(paletteStops[i])
    const to = parse(paletteStops[i + 1])
    const rgb = from.map((c, k) => Math.round(c + (to[k] - c) * t))
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
  }
  return {
    grid: { top: 10, left: 12, right: 40, bottom: 10, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(12, 32, 60, 0.9)',
      borderColor: 'rgba(64, 120, 192, 0.5)',
      textStyle: { color: '#dce8f7' }
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(120, 160, 210, 0.15)' } },
      axisLabel: { color: '#8fb0d6' }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: sorted.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#cfe4ff', fontSize: 12 }
    },
    series: [
      {
        name: '筛查患者数',
        type: 'bar',
        barWidth: 12,
        data: sorted.map((item) => ({
          value: item.value,
          itemStyle: { color: valueColor(item.value), borderRadius: [0, 6, 6, 0] }
        })),
        label: { show: true, position: 'right', color: '#cfe4ff', fontSize: 11 }
      }
    ]
  }
})

const { el } = useChart(option)

onMounted(async () => {
  try {
    const res = await fetch(GEOJSON_URL, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) throw new Error('geojson fetch failed')
    const geo = await res.json()
    echarts.registerMap('china', geo)
    featureNames.value = geo.features
      .map((f) => f.properties && f.properties.name)
      .filter(Boolean)
    mode.value = 'map'
  } catch {
    mode.value = 'bar'
  }
  emit('mode-change', mode.value)
})
</script>

<style scoped>
.chart {
  flex: 1;
  min-height: 260px;
}
</style>