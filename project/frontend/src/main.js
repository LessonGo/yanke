import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './styles/index.css'

const app = createApp(App)

app.use(ElementPlus, { locale: zhCn })
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(router)

app.config.errorHandler = (err, instance, info) => {
  console.error('[vue-error]', info, err)
  showDiagnosis(`页面渲染异常：${info} — ${err && err.message ? err.message : err}`)
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled-rejection]', event.reason)
  showDiagnosis(`异步操作异常：${event.reason && event.reason.message ? event.reason.message : event.reason}`)
})

window.addEventListener('error', (event) => {
  if (event.message) {
    console.error('[window-error]', event.message)
    showDiagnosis(`脚本异常：${event.message}`)
  }
})

function showDiagnosis(text) {
  if (document.getElementById('app-diagnosis')) {
    return
  }
  const el = document.createElement('div')
  el.id = 'app-diagnosis'
  el.textContent = `【诊断】${text}`
  el.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b3261e;color:#fff;' +
    'padding:8px 14px;font-size:12px;font-family:Microsoft YaHei,sans-serif;white-space:nowrap;' +
    'overflow:hidden;text-overflow:ellipsis;cursor:pointer;'
  el.title = '点击关闭诊断提示'
  el.addEventListener('click', () => el.remove())
  document.body.appendChild(el)
}

app.mount('#app')