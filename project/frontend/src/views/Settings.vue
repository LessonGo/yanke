<template>
  <div class="settings-page">
    <el-card shadow="never" class="tabs-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="系统信息" name="info">
          <div class="info-toolbar">
            <el-button size="small" :icon="Refresh" :loading="loading" @click="loadInfo">刷新</el-button>
            <el-tag v-if="info" :type="healthType" size="small" effect="dark">{{ healthText }}</el-tag>
          </div>

          <el-descriptions v-if="info" :column="2" border class="info-desc">
            <el-descriptions-item label="平台名称">{{ info.appName }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ info.version }}</el-descriptions-item>
            <el-descriptions-item label="前端技术栈">{{ info.frontend }}</el-descriptions-item>
            <el-descriptions-item label="后端技术栈">{{ info.backend }}</el-descriptions-item>
            <el-descriptions-item label="数据源">{{ info.dataSource }}</el-descriptions-item>
            <el-descriptions-item label="服务时间">{{ info.serverTime }}</el-descriptions-item>
            <el-descriptions-item label="Node 版本">{{ info.nodeVersion }}</el-descriptions-item>
          </el-descriptions>

          <div class="counts-grid">
            <div v-for="item in countCards" :key="item.key" class="count-card">
              <div class="count-num">{{ item.value }}</div>
              <div class="count-label">{{ item.label }}</div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="账号与权限" name="accounts">
          <div class="section-title">演示账号（{{ users.length }} 个）</div>
          <el-table :data="users" stripe border size="small">
            <el-table-column prop="username" label="账号" width="120" />
            <el-table-column prop="name" label="姓名" width="140" />
            <el-table-column prop="roleName" label="角色" width="120" />
            <el-table-column prop="role" label="角色标识" width="120" />
            <el-table-column label="演示口令" width="110">
              <template #default>123456</template>
            </el-table-column>
            <el-table-column label="可见菜单数" width="110" align="center">
              <template #default="{ row }">{{ visibleMenuCount(row.role) }}</template>
            </el-table-column>
          </el-table>

          <div class="section-title perm-title">角色权限矩阵（菜单 × 角色）</div>
          <el-table :data="permissionRows" border size="small">
            <el-table-column prop="title" label="菜单" width="160" />
            <el-table-column v-for="role in roleColumns" :key="role.value" :label="role.label" align="center">
              <template #default="{ row }">
                <el-icon v-if="row.roles.includes(role.value)" color="#67c23a"><CircleCheckFilled /></el-icon>
                <span v-else class="perm-none">—</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="数据维护" name="maintenance">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="maint-tip"
            title="数据复位将覆盖当前演示数据（含手工新建的预约、出入库记录、AI 报告）"
          >
            <template #default>复位操作仅影响本机 db.json，需后端服务在线；建议在每组演示开始前执行一次。</template>
          </el-alert>

          <div class="reset-list">
            <div v-for="item in resetScopes" :key="item.scope" class="reset-item">
              <div class="reset-info">
                <div class="reset-label">{{ item.label }}</div>
                <div class="reset-desc">{{ item.description }}</div>
              </div>
              <el-button
                type="danger"
                plain
                size="small"
                :loading="resetting === item.scope"
                :disabled="resetting !== '' && resetting !== item.scope"
                @click="handleReset(item)"
              >
                复位
              </el-button>
            </div>
          </div>

          <div class="section-title">当前数据规模</div>
          <el-descriptions v-if="info" :column="4" border size="small">
            <el-descriptions-item label="患者">{{ info.counts.patients }}</el-descriptions-item>
            <el-descriptions-item label="检查记录">{{ info.counts.exams }}</el-descriptions-item>
            <el-descriptions-item label="预约">{{ info.counts.reservations }}</el-descriptions-item>
            <el-descriptions-item label="设备">{{ info.counts.devices }}</el-descriptions-item>
            <el-descriptions-item label="耗材">{{ info.counts.consumables }}</el-descriptions-item>
            <el-descriptions-item label="出入库流水">{{ info.counts.stockLogs }}</el-descriptions-item>
            <el-descriptions-item label="AI 报告">{{ info.counts.reports }}</el-descriptions-item>
            <el-descriptions-item label="账号">{{ info.counts.users }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="关于" name="about">
          <div class="about-block">
            <div class="about-title">项目定位</div>
            <div class="about-text">
              本系统为「新型高性能眼科 OCT 设备 + 智慧管理平台」项目的答辩演示系统：以真实交互 + 集中管理的模拟数据呈现
              数据中心大屏、患者管理、检查管理、AI 辅助诊断、设备与耗材管理、移动端扫码查看等核心能力，不对接真实 OCT 硬件、不运行真实 AI 模型。
            </div>
          </div>
          <div class="about-block">
            <div class="about-title">演示账号</div>
            <div class="about-text">admin / doctor / nurse / tech，口令均为 123456；不同角色可见菜单不同（管理员可见全部）。</div>
          </div>
          <div class="about-block">
            <div class="about-title">验收脚本清单</div>
            <div class="about-scripts">
              <el-tag v-for="item in acceptScripts" :key="item" size="small" effect="plain" class="script-tag">{{ item }}</el-tag>
            </div>
          </div>
          <div class="about-block">
            <div class="about-title">技术说明与限制</div>
            <div class="about-text">
              · 数据层：JSON 文件库（shared/db.json），前后端共用同一数据层，单机部署、零外部依赖；<br />
              · 写操作（预约 / 报告签发 / 出入库 / 设备状态）实时落盘并带截断回读校验；<br />
              · AI 读片、模拟数据采集为前端演示动画，指标数据遵循确定性种子演化（同日稳定、跨日变化）；<br />
              · 手机扫码需与本机同一局域网，也可用浏览器设备模式（F12）模拟移动端查看。
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { dataService } from '../services/dataService'
import { menus, roleOptions } from '../config/menus'

const activeTab = ref('info')
const loading = ref(false)
const info = ref(null)
const users = ref([])
const resetScopes = ref([])
const resetting = ref('')
const online = ref(false)

const roleColumns = roleOptions

const countCards = computed(() => {
  if (!info.value) return []
  const c = info.value.counts
  return [
    { key: 'patients', label: '患者', value: c.patients },
    { key: 'exams', label: '检查记录', value: c.exams },
    { key: 'reservations', label: '检查预约', value: c.reservations },
    { key: 'devices', label: 'OCT 设备', value: c.devices },
    { key: 'consumables', label: '耗材种类', value: c.consumables },
    { key: 'reports', label: 'AI 报告', value: c.reports },
    { key: 'users', label: '演示账号', value: c.users }
  ]
})

const healthType = computed(() => (online.value ? 'success' : 'warning'))
const healthText = computed(() => (online.value ? '后端服务在线' : 'Mock 只读模式（后端未连接）'))

const permissionRows = computed(() =>
  menus.map((menu) => ({ title: menu.title, path: menu.path, roles: menu.roles }))
)

const acceptScripts = [
  '验收-01-登录与大屏.bat',
  '验收-02-患者管理.bat',
  '验收-03-检查管理.bat',
  '验收-04-AI辅助诊断.bat',
  '验收-05-设备与耗材.bat',
  '验收-06-移动端H5.bat',
  '验收-07-系统设置.bat'
]

function visibleMenuCount(role) {
  return menus.filter((menu) => menu.roles.includes(role)).length
}

async function loadInfo() {
  loading.value = true
  try {
    info.value = await dataService.getSystemInfo()
    online.value = true
  } catch (err) {
    online.value = false
    ElMessage.error(err.message || '系统信息加载失败')
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    users.value = await dataService.getSystemUsers()
  } catch {
    users.value = []
  }
}

async function loadScopes() {
  try {
    resetScopes.value = await dataService.getResetScopes()
  } catch {
    resetScopes.value = []
  }
}

async function handleReset(item) {
  if (resetting.value) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定复位「${item.label}」吗？${item.description}。当前手工产生的相关数据将被覆盖。`,
      '数据复位确认',
      { confirmButtonText: '确认复位', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  resetting.value = item.scope
  try {
    const result = await dataService.resetDemoData(item.scope)
    ElMessage.success(`复位完成：${(result.executed || []).join('、')}`)
    await loadInfo()
  } catch (err) {
    ElMessage.error(err.message || '数据复位失败')
  } finally {
    resetting.value = ''
  }
}

defineExpose({ info, users, resetScopes, activeTab, resetting, online, loadInfo, loadUsers, loadScopes, handleReset, visibleMenuCount })

onMounted(() => {
  loadInfo()
  loadUsers()
  loadScopes()
})
</script>

<style scoped>
.settings-page {
  padding: 16px;
  min-height: 100%;
}

.tabs-card {
  min-height: 480px;
}

.info-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.info-desc {
  margin-bottom: 16px;
}

.counts-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px;
}

.count-card {
  padding: 16px 10px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f2f7ff, #e8f1ff);
  border: 1px solid #d6e6ff;
  text-align: center;
}

.count-num {
  font-size: 24px;
  font-weight: 700;
  color: #1f2d3d;
}

.count-label {
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 16px 0 10px;
}

.perm-title {
  margin-top: 20px;
}

.perm-none {
  color: #c0c4cc;
}

.maint-tip {
  margin-bottom: 14px;
}

.reset-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafbfc;
}

.reset-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.reset-desc {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}

.about-block {
  margin-bottom: 18px;
}

.about-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.about-text {
  font-size: 13px;
  line-height: 1.8;
  color: #606266;
}

.about-scripts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.script-tag {
  font-family: Consolas, 'Microsoft YaHei', monospace;
}

@media (max-width: 1200px) {
  .counts-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>