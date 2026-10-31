<template>
  <div ref="el" class="chart"></div>
</template>

<script setup>
import { computed } from 'vue'
import { useChart } from '../../composables/useChart'

const props = defineProps({
  diseases: { type: Array, default: () => [] }
})

const total = computed(() => props.diseases.reduce((sum, item) => sum + item.value, 0))

const option = computed(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(12, 32, 60, 0.9)',
    borderColor: 'rgba(64, 120, 192, 0.5)',
    textStyle: { color: '#dce8f7' },
    formatter: '{b}<br/>检出 {c} 例（{d}%）'
  },
  legend: {
    orient: 'vertical',
    right: 4,
    top: 'middle',
    textStyle: { color: '#9fb8d4', fontSize: 11 },
    itemWidth: 12,
    itemHeight: 8
  },
  title: {
    text: '累计检出',
    subtext: `${total.value} 例`,
    left: '34%',
    top: '42%',
    textAlign: 'center',
    textStyle: { color: '#8fb0d6', fontSize: 13, fontWeight: 400 },
    subtextStyle: { color: '#ffffff', fontSize: 22, fontWeight: 700 }
  },
  series: [
    {
      name: '疾病分布',
      type: 'pie',
      radius: ['52%', '72%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#0d2140', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, color: '#ffffff', formatter: '{b}\n{d}%' }
      },
      data: props.diseases.map((item, index) => ({
        ...item,
        itemStyle: { color: palette[index % palette.length] }
      }))
    }
  ]
}))

const palette = ['#4ea1ff', '#37d0c0', '#7b6cff', '#f6b352', '#ff7b9c', '#59d97a', '#5ac8fa', '#b0a4f5']

const { el } = useChart(option)
</script>

<style scoped>
.chart {
  flex: 1;
  min-height: 260px;
}
</style>