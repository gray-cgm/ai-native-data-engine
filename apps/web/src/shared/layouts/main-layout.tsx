import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { navGroups } from './nav-config'
import { LayoutHeader } from './components/layout-header'
import { LayoutSidebar } from './components/layout-sidebar'
import { LayoutMicroMenu } from './components/layout-micro-menu'
import '../../styles/main-layout.css'

export function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapseMicroApp, setCollapseMicroApp] = useState(false)
  const [collapseMenu, setCollapseMenu] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)

  // 根据当前路由自动选中对应的模块
  useEffect(() => {
    for (let i = 0; i < navGroups.length; i++) {
      for (const item of navGroups[i].items) {
        if (
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path + '/'))
        ) {
          setActiveGroupIndex(i)
          return
        }
      }
    }
  }, [location.pathname])

  // 当前选中模块
  const activeGroup = navGroups[activeGroupIndex]

  // 当前活跃的菜单标签
  const currentMenuLabel = useMemo(() => {
    return activeGroup?.label ?? 'Dashboard'
  }, [activeGroup])

  // 当前模块下的菜单项
  const activeSideItems = useMemo(() => {
    return activeGroup?.items ?? []
  }, [activeGroup])

  // 处理菜单项点击
  const handleNavItemClick = (path: string) => {
    navigate(path)
  }

  // 处理模块切换
  const handleGroupChange = (index: number) => {
    setActiveGroupIndex(index)
    // 切换模块时导航到该模块第一个菜单项
    const firstItem = navGroups[index]?.items[0]
    if (firstItem) {
      navigate(firstItem.path)
    }
  }

  // 处理侧边栏折叠
  const handleToggleMicroApp = () => {
    setCollapseMicroApp((prev) => !prev)
    localStorage.setItem('collapseMicroApp', (!collapseMicroApp).toString())
  }

  const handleToggleMenu = () => {
    setCollapseMenu((prev) => !prev)
    localStorage.setItem('collapseMenu', (!collapseMenu).toString())
  }

  const handleToggleFullscreen = () => {
    setFullscreen((prev) => !prev)
  }

  // 从本地存储恢复状态
  useEffect(() => {
    const savedCollapseMicroApp = localStorage.getItem('collapseMicroApp')
    if (savedCollapseMicroApp) {
      setCollapseMicroApp(savedCollapseMicroApp === 'true')
    }

    const savedCollapseMenu = localStorage.getItem('collapseMenu')
    if (savedCollapseMenu) {
      setCollapseMenu(savedCollapseMenu === 'true')
    }
  }, [])

  return (
    <div className={`main-layout ${fullscreen ? 'fullscreen' : ''}`}>
      {/* Header */}
      {!fullscreen && (
        <LayoutHeader
          currentMenuLabel={currentMenuLabel}
          onToggleMicroApp={handleToggleMicroApp}
          collapsed={collapseMicroApp}
          onToggleMenu={handleToggleMenu}
          collapseMenu={collapseMenu}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* Main content area */}
      <div className="main-content">
        {/* 左侧模块选择器 */}
        {!fullscreen && (
          <LayoutMicroMenu
            groups={navGroups}
            activeIndex={activeGroupIndex}
            collapsed={collapseMicroApp}
            onGroupChange={handleGroupChange}
          />
        )}

        {/* Navigation and content */}
        <div className="content-wrapper">
          {/* 当前模块的子菜单 */}
          {!fullscreen && (
            <LayoutSidebar
              items={activeSideItems}
              currentPath={location.pathname}
              collapsed={collapseMenu}
              onNavClick={handleNavItemClick}
            />
          )}

          {/* Main outlet */}
          <main className={`main-outlet ${collapseMenu ? 'menu-collapsed' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Fullscreen button */}
      <button className="fullscreen-button" onClick={handleToggleFullscreen}>
        {fullscreen ? '✕' : '⛶'}
      </button>
    </div>
  )
}
