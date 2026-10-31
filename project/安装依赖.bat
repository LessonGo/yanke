@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title 眼科OCT智慧管理平台 - 一键安装依赖
cd /d %~dp0

echo ==========================================================
echo   眼科 OCT 智慧管理平台（演示系统）- 一键安装依赖
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js 环境
    echo        请先安装 Node.js 20.19 或更高版本：https://nodejs.org/
    echo        安装完成后重新双击本脚本
    pause
    exit /b 1
)

echo 当前环境：
node -v
call npm -v
echo.

if exist "backend\node_modules" (
    echo [1/2] 后端依赖已存在，跳过安装
) else (
    echo [1/2] 正在安装后端依赖（Express + CORS）...
    pushd backend
    call npm install --registry=https://registry.npmmirror.com --cache "%LOCALAPPDATA%\npm-cache"
    if errorlevel 1 ( echo [错误] 后端依赖安装失败，请检查网络后重试 & popd & pause & exit /b 1 )
    popd
)

if exist "frontend\node_modules" (
    echo [2/2] 前端依赖已存在，跳过安装
) else (
    echo [2/2] 正在安装前端依赖（Vue3 / Element Plus / ECharts 等，约需 2-5 分钟）...
    pushd frontend
    call npm install --registry=https://registry.npmmirror.com --cache "%LOCALAPPDATA%\npm-cache"
    if errorlevel 1 ( echo [错误] 前端依赖安装失败，请检查网络后重试 & popd & pause & exit /b 1 )
    popd
)

echo.
echo ==========================================================
echo   依赖安装完成
echo   下一步：双击任一「验收-XX-*.bat」即可自动启动服务并打开浏览器
echo   推荐入口：验收-01-登录与大屏.bat（完整演示从登录开始）
echo   演示账号：admin / doctor / nurse / tech，密码均为 123456
echo ==========================================================
pause