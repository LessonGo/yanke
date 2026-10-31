import { createRouter, createWebHistory } from 'vue-router'
import { menus } from '../config/menus'
import { useAuthStore } from '../stores/auth'

const VALID_ROLES = ['admin', 'doctor', 'nurse', 'tech']

const Dashboard = () => import('../views/Dashboard.vue')
const UnderConstruction = () => import('../views/UnderConstruction.vue')
const PatientDetail = () => import('../views/PatientDetail.vue')

const viewMap = {
  '/dashboard': Dashboard,
  '/patients': () => import('../views/Patients.vue'),
  '/exams': () => import('../views/Exams.vue'),
  '/ai-diagnosis': () => import('../views/AiDiagnosis.vue'),
  '/devices': () => import('../views/Devices.vue'),
  '/consumables': () => import('../views/Consumables.vue'),
  '/settings': () => import('../views/Settings.vue')
}

const children = menus.map((menu) => ({
  path: menu.path.slice(1),
  name: menu.title,
  component: viewMap[menu.path] || UnderConstruction,
  meta: { title: menu.title, roles: menu.roles }
}))

const patientsMenu = menus.find((menu) => menu.path === '/patients')
children.push({
  path: 'patients/:id',
  name: '患者详情',
  component: PatientDetail,
  meta: { title: '患者详情', roles: patientsMenu ? patientsMenu.roles : ['admin', 'doctor', 'nurse'] }
})

const examsMenu = menus.find((menu) => menu.path === '/exams')
children.push({
  path: 'exams/collect/:id',
  name: '模拟数据采集',
  component: () => import('../views/Collect.vue'),
  meta: { title: '模拟数据采集', roles: examsMenu ? examsMenu.roles : ['admin', 'doctor', 'nurse'] }
})

const aiMenu = menus.find((menu) => menu.path === '/ai-diagnosis')
children.push({
  path: 'ai-diagnosis/report/:examId',
  name: 'AI 诊断报告',
  component: () => import('../views/AiReport.vue'),
  meta: { title: 'AI 诊断报告', roles: aiMenu ? aiMenu.roles : ['admin', 'doctor'] }
})

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/m/report/:examId',
    name: '移动端报告',
    component: () => import('../views/mobile/MobileReport.vue'),
    meta: { title: '检查报告（手机版）', public: true }
  },
  {
    path: '/m/patient/:id',
    name: '移动端健康趋势',
    component: () => import('../views/mobile/MobileTrend.vue'),
    meta: { title: '健康趋势（手机版）', public: true }
  },
  {
    path: '/',
    component: () => import('../layout/MainLayout.vue'),
    redirect: '/dashboard',
    children
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

let redirectCount = 0

router.beforeEach((to) => {
  const auth = useAuthStore()
  document.title = to.meta.title ? `${to.meta.title} - 眼科 OCT 智慧管理平台` : '眼科 OCT 智慧管理平台'

  if (to.meta.public) {
    return true
  }

  const sessionValid = auth.isLoggedIn && VALID_ROLES.includes(auth.role)

  if (!sessionValid) {
    if (auth.isLoggedIn) {
      auth.logout()
    }
    if (to.path !== '/login') {
      return { path: '/login', query: to.fullPath === '/dashboard' ? {} : { redirect: to.fullPath } }
    }
    return true
  }

  if (to.path === '/login') {
    return '/dashboard'
  }

  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    redirectCount += 1
    if (redirectCount > 3) {
      redirectCount = 0
      auth.logout()
      return { path: '/login' }
    }
    return '/dashboard'
  }

  redirectCount = 0
  return true
})

router.onError((err) => {
  console.error('[router] 路由加载失败:', err)
})

export default router