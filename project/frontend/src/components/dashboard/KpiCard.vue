<template>
  <div class="kpi-card">
    <div class="kpi-icon">
      <el-icon :size="26"><component :is="icon" /></el-icon>
    </div>
    <div class="kpi-body">
      <div class="kpi-value">
        <span class="number">{{ display }}</span>
        <span class="unit">{{ kpi.unit }}</span>
      </div>
      <div class="kpi-label">{{ kpi.label }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCountUp } from '../../composables/useCountUp'

const props = defineProps({
  kpi: { type: Object, required: true }
})

const iconMap = {
  todayPatients: 'User',
  monthPatients: 'Calendar',
  aiCoverage: 'MagicStick',
  reportRate: 'Document',
  avgDuration: 'Timer',
  aiReadTime: 'Lightning',
  onlineDevices: 'Monitor'
}

const icon = computed(() => iconMap[props.kpi.key] || 'DataLine')

const display = useCountUp(() => props.kpi.value)
</script>

<style scoped>
.kpi-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(30, 64, 118, 0.85), rgba(17, 39, 75, 0.85));
  border: 1px solid rgba(64, 120, 192, 0.35);
}

.kpi-icon {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6fc3ff;
  background: rgba(64, 158, 255, 0.14);
  flex-shrink: 0;
}

.kpi-body {
  min-width: 0;
}

.kpi-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.kpi-value .number {
  font-size: 28px;
  font-weight: 700;
  font-family: 'Bahnschrift', 'Microsoft YaHei', sans-serif;
  color: #ffffff;
}

.kpi-value .unit {
  font-size: 12px;
  color: #8fb0d6;
}

.kpi-label {
  margin-top: 4px;
  font-size: 13px;
  color: #9fb8d4;
  white-space: nowrap;
}
</style>