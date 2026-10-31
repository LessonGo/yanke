<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <el-icon :size="40" color="#ffffff"><View /></el-icon>
        <h1>眼科 OCT 智慧管理平台</h1>
        <p>OCT 智慧管理平台 · 答辩演示系统</p>
      </div>

      <el-form :model="form" size="large" @keyup.enter="handleLogin">
        <el-form-item label="演示角色">
          <el-radio-group v-model="form.role">
            <el-radio-button v-for="role in roleOptions" :key="role.value" :label="role.value">
              {{ role.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="请输入账号" :prefix-icon="User" clearable />
        </el-form-item>

        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <el-button
          type="primary"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          {{ loading ? '登录中...' : '登 录' }}
        </el-button>
      </el-form>

      <el-alert type="info" :closable="false" class="login-tip">
        <template #title>
          演示账号：选中角色后自动填充（密码统一为 123456），不同角色登录后可见菜单不同
        </template>
      </el-alert>
    </div>

    <div class="login-footer">基于"云-边-端"协同架构 · AI 辅助诊断 · 数据中心大屏 · 设备智慧管理</div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { roleOptions } from '../config/menus'
import { useAuthStore } from '../stores/auth'
import { dataService } from '../services/dataService'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({
  role: 'admin',
  username: 'admin',
  password: '123456'
})

const loading = ref(false)

watch(
  () => form.role,
  (role) => {
    const matched = roleOptions.find((item) => item.value === role)
    if (matched) {
      form.username = matched.username
      form.password = '123456'
    }
  }
)

async function handleLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    const user = await dataService.login({ username: form.username, password: form.password })
    auth.login(user)
    ElMessage.success(`欢迎回来，${user.name}`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.push(redirect)
  } catch (err) {
    ElMessage.error(err.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(64, 158, 255, 0.35), transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(114, 46, 209, 0.3), transparent 50%),
    linear-gradient(135deg, #0d1f3c 0%, #14355e 100%);
}

.login-card {
  width: 420px;
  padding: 36px 40px 28px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}

.login-header {
  text-align: center;
  margin-bottom: 22px;
}

.login-header h1 {
  margin-top: 10px;
  font-size: 22px;
  color: #1f2d3d;
}

.login-header p {
  margin-top: 6px;
  font-size: 13px;
  color: #8a97a8;
}

.login-btn {
  width: 100%;
  margin-top: 4px;
  font-size: 16px;
  letter-spacing: 8px;
}

.login-tip {
  margin-top: 18px;
}

.login-footer {
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  letter-spacing: 1px;
}
</style>