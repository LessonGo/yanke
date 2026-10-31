<template>
  <div ref="el" class="chart"></div>
</template>

<script setup>
import { computed } from 'vue'
import { useChart } from '../../composables/useChart'

const props = defineProps({
  flow: { type: Array, default: () => [] }
})

const option = computed(() => ({
  grid: { top: 30, left: 12, right: 20, bottom: 10, containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(12, 32, 60, 0.9)',
    borderColor: 'rgba(64, 120, 192, 0.5)',
    textStyle: { color: '#dce8f7' }
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.flow.map((item) => item.hour),
    axisLine: { lineStyle: { color: 'rgba(120, 160, 210, 0.4)' } },
    axisLabel: { color: '#8fb0d6' }
  },
  yAxis: {
    type: 'value',
    name: '就诊量（例）',
    nameTextStyle: { color: '#8fb0d6' },
    splitLine: { lineStyle: { color: 'rgba(120, 160, 210, 0.15)' } },
    axisLabel: { color: '#8fb0d6' }
  },
  series: [
    {
      name: '患者就诊量',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      data: props.flow.map((item) => item.count),
      lineStyle: { width: 3, color: '#4ea1ff' },
      itemStyle: { color: '#4ea1ff', borderColor: '#0e2a4d', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(78, 161, 255, 0.55)' },
            { offset: 1, color: 'rgba(78, 161, 255, 0.02)' }
          ]
        }
      },
      markPoint: {
        data: [{ type: 'max', name: '峰值' }],
        symbolSize: 46,
        itemStyle: { color: 'rgba(78, 161, 255, 0.9)' },
        label: { color: '#ffffff', fontSize: 11 }
      }
    }
  ]
}))

const { el } = useChart(option)
</script>

<style scoped>
.chart {
  flex: 1;
  min-height: 260px;
}
</style>