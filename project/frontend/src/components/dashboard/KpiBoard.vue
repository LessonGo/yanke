<template>
  <div class="kpi-board">
    <KpiCard v-for="kpi in kpis" :key="kpi.key" :kpi="kpi" />
  </div>
</template>

<script setup>
import KpiCard from './KpiCard.vue'

defineProps({
  kpis: { type: Array, default: () => [] }
})
</script>

<style scoped>
.kpi-board {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}

@media (max-width: 1400px) {
  .kpi-board {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 700px) {
  .kpi-board {
    grid-template-columns: 1fr;
  }
}
</style>