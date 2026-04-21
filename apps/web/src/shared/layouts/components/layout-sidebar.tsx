import { createElement, useMemo } from 'react'
import { Layout, Menu, Button, type MenuProps } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import type { NavItem } from '../nav-config'
import '../../../styles/layout-sidebar.css'

const { Sider } = Layout

interface LayoutSidebarProps {
  items: NavItem[]
  currentPath: string
  collapsed: boolean
  visible: boolean
  onNavClick: (path: string) => void
  onToggleCollapse?: () => void
}

export function LayoutSidebar({
  items,
  currentPath,
  collapsed,
  visible,
  onNavClick,
  onToggleCollapse,
}: LayoutSidebarProps) {
  // Determine active (selected) key by longest prefix match
  const selectedKey = useMemo(() => {
    return items
      .filter((item) => {
        if (item.path === '/') return currentPath === '/'
        return currentPath === item.path || currentPath.startsWith(item.path + '/')
      })
      .sort((a, b) => b.path.length - a.path.length)[0]?.path
  }, [items, currentPath])

  // Convert NavItem[] to antd MenuProps['items']
  const menuItems: MenuProps['items'] = useMemo(() => {
    return items.map((item) => ({
      key: item.path,
      label: item.label,
      icon: item.icon ? createElement(item.icon) : undefined,
    }))
  }, [items])

  const handleMenuClick: MenuProps['onClick'] = (info) => {
    onNavClick(info.key)
  }

  return (
    <Sider
      width={visible ? 200 : 0}
      collapsedWidth={visible ? 50 : 0}
      collapsed={collapsed}
      className={`layout-sidebar-sider ${!visible ? 'hidden' : ''}`}
    >
      {!!items.length && visible && (
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={menuItems}
          className="layout-sidebar-menu"
          style={{ height: visible ? '100%' : 0 }}
          onClick={handleMenuClick}
        />
      )}
      {visible && onToggleCollapse && (
        <Button
          type="default"
          shape="circle"
          size="small"
          className="sidebar-collapse-btn"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand' : 'Collapse'}
        />
      )}
    </Sider>
  )
}
