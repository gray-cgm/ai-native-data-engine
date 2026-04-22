import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { KeepAliveOutlet } from '../components/keep-alive-outlet'
import { navGroups } from './nav-config'
import { LayoutHeader } from './components/layout-header'
import { LayoutSidebar } from './components/layout-sidebar'
import { LayoutMicroMenu } from './components/layout-micro-menu'
import { FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons'
import { FloatButton } from 'antd'
import '../../styles/main-layout.css'

export function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapseApp, setCollapseApp] = useState(
    localStorage.getItem('collapseApp') !== 'false',
  )
  const [collapseMenu, setCollapseMenu] = useState(
    localStorage.getItem('collapseMenu') === 'true',
  )
  const [fullscreen, setFullscreen] = useState(false)
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)

  // Whether the settings page is currently active
  const isSettingsActive = location.pathname === '/settings' || location.pathname.startsWith('/settings/')

  // Auto-select module based on current route
  useEffect(() => {
    if (isSettingsActive) {
      setActiveGroupIndex(-1)
      return
    }
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
  }, [location.pathname, isSettingsActive])

  // Current active module (undefined when settings is active)
  const activeGroup = activeGroupIndex >= 0 ? navGroups[activeGroupIndex] : undefined

  // Current active menu label
  const activeMenuLabel = useMemo(() => {
    return activeGroup?.label ?? 'Dashboard'
  }, [activeGroup])

  // Current module's side items
  const activeSideItems = useMemo(() => {
    return activeGroup?.items ?? []
  }, [activeGroup])

  const hasSideMenu = activeSideItems.length > 0

  const onlyOneSideMenu = activeSideItems.length <= 1

  const showSidebar = hasSideMenu && !fullscreen && !onlyOneSideMenu

  // Handle nav item click
  const handleNavItemClick = (path: string) => {
    navigate(path)
  }

  // Handle module switch
  const handleGroupChange = (index: number) => {
    setActiveGroupIndex(index)
    const firstItem = navGroups[index]?.items[0]
    if (firstItem) {
      navigate(firstItem.path)
    }
  }

  // Handle settings click
  const handleSettingsClick = () => {
    navigate('/settings')
  }

  // Handle app sidebar collapse (left micro menu) - setCollapseApp
  const handleToggleApp = () => {
    const next = !collapseApp
    setCollapseApp(next)
    localStorage.setItem('collapseApp', next.toString())
  }

  // Handle inner menu collapse - setCollapseMenu
  const handleToggleMenu = () => {
    if (!hasSideMenu) return
    const next = !collapseMenu
    setCollapseMenu(next)
    localStorage.setItem('collapseMenu', next.toString())
  }

  // Handle fullscreen toggle
  const handleToggleFullscreen = () => {
    setFullscreen((prev) => !prev)
  }

  // Restore state from localStorage
  useEffect(() => {
    const savedCollapseApp = localStorage.getItem('collapseApp')
    if (savedCollapseApp !== null) {
      setCollapseApp(savedCollapseApp !== 'false')
    }
    const savedCollapseMenu = localStorage.getItem('collapseMenu')
    if (savedCollapseMenu !== null) {
      setCollapseMenu(savedCollapseMenu === 'true')
    }
  }, [])

  return (
    <div className={`main-layout ${fullscreen ? 'fullscreen' : ''}`}>
      <LayoutHeader
        currentMenuLabel={activeMenuLabel}
        onToggleApp={handleToggleApp}
        collapseApp={collapseApp}
        onToggleFullscreen={handleToggleFullscreen}
        onSearchNavigate={handleNavItemClick}
      />

      <div className="main-content">
        <LayoutMicroMenu
          groups={navGroups}
          activeIndex={activeGroupIndex}
          collapsed={fullscreen || collapseApp}
          onGroupChange={handleGroupChange}
          settingsActive={isSettingsActive}
          onSettingsClick={handleSettingsClick}
        />

        <div
          className="content-wrapper"
          style={{
            height: fullscreen ? '100vh' : 'calc(100vh - 50px)',
          }}
        >
          <LayoutSidebar
            items={activeSideItems}
            currentPath={location.pathname}
            collapsed={collapseMenu}
            visible={showSidebar}
            onNavClick={handleNavItemClick}
            onToggleCollapse={handleToggleMenu}
          />

          <main className="main-outlet">
            <KeepAliveOutlet />
          </main>
        </div>
      </div>

      {/* FloatButton - antd FloatButton with glassmorphism style */}
      <FloatButton
        icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        onClick={handleToggleFullscreen}
        className="fullscreen-float-btn"
      />
    </div>
  )
}
