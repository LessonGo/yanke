export const menus = [
  { path: '/dashboard', title: '数据中心大屏', icon: 'DataBoard', roles: ['admin', 'doctor', 'nurse', 'tech'] },
  { path: '/patients', title: '患者管理', icon: 'User', roles: ['admin', 'doctor', 'nurse'] },
  { path: '/exams', title: '检查管理', icon: 'Calendar', roles: ['admin', 'doctor', 'nurse'] },
  { path: '/ai-diagnosis', title: 'AI 辅助诊断', icon: 'MagicStick', roles: ['admin', 'doctor'] },
  { path: '/devices', title: '设备管理', icon: 'Monitor', roles: ['admin', 'tech'] },
  { path: '/consumables', title: '耗材管理', icon: 'Box', roles: ['admin', 'tech'] },
  { path: '/settings', title: '系统设置', icon: 'Setting', roles: ['admin'] }
]

export const roleOptions = [
  { value: 'admin', label: '管理员', username: 'admin', name: '系统管理员' },
  { value: 'doctor', label: '眼科医生', username: 'doctor', name: '陈明医生' },
  { value: 'nurse', label: '眼科护士', username: 'nurse', name: '李婷护士' },
  { value: 'tech', label: '设备技师', username: 'tech', name: '王强技师' }
]