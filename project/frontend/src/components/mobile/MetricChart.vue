<template>
  <div ref="el" class="series-chart"></div>
</template>

<script setup>
import { computed } from 'vue'
import { useChart } from '../../composables/useChart'

const props = defineProps({
  item: { type: Object, required: true }
})

const option = computed(() => ({
  grid: { top: 16, left: 8, right: 14, bottom: 4, containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#dcdfe6',
    textStyle: { color: '#303133', fontSize: 12 },
    formatter: (params) => {
      const p = params[0]
      return `${p.name}<br/>${props.item.label} ${p.value}${props.item.unit}`
    }
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.item.points.map((p) => String(p.date).slice(5)),
    axisLine: { lineStyle: { color: '#e4e7ed' } },
    axisLabel: { color: '#909399', fontSize: 10 }
  },
  yAxis: {
    type: 'value',
    scale: true,
    splitLine: { lineStyle: { color: '#f0f2f5' } },
    axisLabel: { color: '#909399', fontSize: 10 }
  },
  series: [
    {
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: props.item.points.map((p) => p.value),
      lineStyle: { width: 2.5, color: '#409eff' },
      itemStyle: { color: '#409eff' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.02)' }
          ]
        }
      }
    }
  ]
}))

const { el } = useChart(option)
</script>

<style scoped>
.series-chart {
  height: 150px;
}
</style>