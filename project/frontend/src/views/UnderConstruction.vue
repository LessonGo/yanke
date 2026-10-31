<template>
  <div class="under-construction">
    <el-icon :size="72" color="#409eff"><Opportunity /></el-icon>
    <h2>{{ route.meta.title }}</h2>
    <p class="desc">该功能模块已列入开发计划，正在按里程碑顺序推进交付</p>
    <el-tag type="info" effect="plain">详见 docs/02-项目进度.md 的里程碑计划</el-tag>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style scoped>
.under-construction {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background-color: #f0f2f5;
}

.desc {
  color: #909399;
  font-size: 14px;
}
</style>