import { useEffect, useRef, useState } from 'react'
import '../../../styles/layout-header.css'

interface LayoutHeaderProps {
  currentMenuLabel: string
  onToggleMicroApp: () => void
  collapsed: boolean
  onToggleMenu: () => void
  collapseMenu: boolean
  onToggleFullscreen: () => void
}

export function LayoutHeader({
  currentMenuLabel,
  onToggleMicroApp,
  collapsed,
  onToggleMenu,
  collapseMenu,
  onToggleFullscreen,
}: LayoutHeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const closeMenuTimerRef = useRef<number | null>(null)

  const openUserMenu = () => {
    if (closeMenuTimerRef.current) {
      window.clearTimeout(closeMenuTimerRef.current)
      closeMenuTimerRef.current = null
    }
    setShowUserMenu(true)
  }

  const closeUserMenuWithDelay = () => {
    if (closeMenuTimerRef.current) {
      window.clearTimeout(closeMenuTimerRef.current)
    }
    closeMenuTimerRef.current = window.setTimeout(() => {
      setShowUserMenu(false)
      closeMenuTimerRef.current = null
    }, 180)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target as Node)) {
        if (closeMenuTimerRef.current) {
          window.clearTimeout(closeMenuTimerRef.current)
          closeMenuTimerRef.current = null
        }
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      if (closeMenuTimerRef.current) {
        window.clearTimeout(closeMenuTimerRef.current)
        closeMenuTimerRef.current = null
      }
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    // 实现登出逻辑
    window.location.href = '/login'
  }

  return (
    <header className="layout-header">
      {/* Logo and app toggle */}
      <div className="header-left">
        <button
          className={`micro-app-toggle ${collapsed ? 'collapsed' : ''}`}
          onClick={onToggleMicroApp}
          title="Toggle application list"
        >
          ☰
        </button>
        <div className="logo-container">
          <span className="logo-text">AD Data Workbench</span>
        </div>
      </div>

      {/* Center: Menu search and navigation */}
      <div className="header-center">

      </div>

      {/* Right: Actions and user menu */}
      <div className="header-right">
        <div className="header-actions">
          <a href="/help" className="header-link" title="Help">
            ❓
          </a>
          <a href="/feedback" className="header-link" title="Feedback">
            💬
          </a>
        </div>

        {/* User menu */}
        <div
          className={`user-menu-container ${showUserMenu ? 'open' : ''}`}
          ref={userMenuRef}
          onMouseEnter={openUserMenu}
          onMouseLeave={closeUserMenuWithDelay}
        >
          <button
            className="user-menu-trigger"
            type="button"
          >
            <span className="user-avatar">👤</span>
            <span className="user-name">Admin</span>
          </button>

          <div className="user-menu-dropdown">
            <button className="user-menu-item">Profile</button>
            <button className="user-menu-item">Settings</button>
            <button
              className="user-menu-item logout-item"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
