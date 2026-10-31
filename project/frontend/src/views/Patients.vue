<template>
  <div class="patients-page">
    <el-card shadow="never" class="filter-card">
      <el-form inline @submit.prevent>
        <el-form-item label="关键字">
          <el-input
            v-model="filters.keyword"
            placeholder="姓名 / 手机号"
            clearable
            class="filter-input"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="病种标签">
          <el-select
            v-model="filters.tag"
            placeholder="全部标签"
            clearable
            class="filter-select"
            @change="handleSearch"
          >
            <el-option
              v-for="tag in tagOptions"
              :key="tag.name"
              :label="`${tag.name}（${tag.count}）`"
              :value="tag.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="rows"
        stripe
        highlight-current-row
        class="patient-table"
        @row-click="goDetail"
      >
        <el-table-column prop="id" label="档案号" width="120" />
        <el-table-column prop="name" label="姓名" width="100">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click.stop="goDetail(row)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="gender" label="性别" width="70" align="center" />
        <el-table-column prop="age" label="年龄" width="70" align="center" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="病种标签" min-width="200">
          <template #default="{ row }">
            <template v-if="row.tags && row.tags.length">
              <el-tag
                v-for="tag in row.tags"
                :key="tag"
                size="small"
                effect="light"
                class="tag-item"
              >
                {{ tag }}
              </el-tag>
            </template>
            <span v-else class="no-tag">健康筛查</span>
          </template>
        </el-table-column>
        <el-table-column prop="lastExamDate" label="最近检查" width="120" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="goDetail(row)">
              <el-icon><View /></el-icon>
              <span>详情</span>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="load(false)"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { dataService } from '../services/dataService'

const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const tagOptions = ref([])

const filters = reactive({ keyword: '', tag: '' })

function statusType(status) {
  if (status === '随访中') return 'success'
  if (status === '待复查') return 'warning'
  return 'info'
}

async function load(resetToFirst = true) {
  if (resetToFirst) {
    page.value = 1
  }
  loading.value = true
  loadError.value = ''
  try {
    const data = await dataService.getPatients({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filters.keyword.trim(),
      tag: filters.tag
    })
    rows.value = data.list
    total.value = data.total
  } catch (err) {
    rows.value = []
    total.value = 0
    loadError.value = err.message || '患者数据加载失败'
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  load(true)
}

function handleReset() {
  filters.keyword = ''
  filters.tag = ''
  load(true)
}

function handleSizeChange() {
  load(true)
}

function goDetail(row) {
  router.push(`/patients/${row.id}`)
}

onMounted(async () => {
  load(true)
  try {
    tagOptions.value = await dataService.getPatientTags()
  } catch {
    tagOptions.value = []
  }
})

defineExpose({ filters, page, pageSize, load })
</script>

<style scoped>
.patients-page {
  padding: 16px;
  min-height: 100%;
}

.filter-card {
  margin-bottom: 14px;
}

.filter-card :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 18px;
}

.filter-input {
  width: 220px;
}

.filter-select {
  width: 240px;
}

.table-card {
  min-height: 420px;
}

.patient-table {
  cursor: pointer;
  width: 100%;
}

.tag-item {
  margin-right: 6px;
}

.no-tag {
  color: #909399;
  font-size: 12px;
}

.pager {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
</style>