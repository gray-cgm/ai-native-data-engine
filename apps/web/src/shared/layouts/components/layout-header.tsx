import { createElement, useMemo, useState } from 'react'
import { SearchOutlined, QuestionCircleOutlined, BugOutlined, MessageOutlined, UserOutlined, LogoutOutlined, SettingOutlined, ProfileOutlined } from '@ant-design/icons'
import { Avatar, Button, Dropdown, Menu, Space, TreeSelect, type MenuProps } from 'antd'
import { navGroups } from '../nav-config'
import '../../../styles/layout-header.css'

interface HeaderNavItem {
  key: string
  label: string
  icon?: string
}

interface LayoutHeaderProps {
  currentMenuLabel: string
  onToggleApp: () => void
  collapseApp: boolean
  onToggleFullscreen: () => void
  headerNavItems?: HeaderNavItem[]
  activeNavKey?: string
  onNavItemClick?: (key: string) => void
  onSearchNavigate?: (path: string) => void
}

export function LayoutHeader({
  currentMenuLabel,
  onToggleApp,
  collapseApp,
  onToggleFullscreen,
  headerNavItems = [],
  activeNavKey,
  onNavItemClick,
  onSearchNavigate,
}: LayoutHeaderProps) {
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined)

  const searchTreeData = useMemo(() => {
    return navGroups.map((group) => ({
      title: group.label,
      value: `group-${group.label}`,
      selectable: false,
      icon: createElement(group.icon),
      children: group.items.map((item) => ({
        title: item.label,
        value: item.path,
        icon: item.icon ? createElement(item.icon) : undefined,
      })),
    }))
  }, [])

  const handleLogout = () => {
    window.location.href = '/login'
  }

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: 'Profile', icon: <ProfileOutlined /> },
    { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
    { type: 'divider' },
    { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, danger: true },
  ]

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      handleLogout()
    }
  }

  return (
    <header className="layout-header">
      {/* Logo Container - xproduct logoContainer */}
      <div
        className={`logo-container ${collapseApp ? 'collapsed' : ''}`}
        onClick={onToggleApp}
      >
        <img className="logo-icon" src="/logo.png" alt="logo" />
      </div>

      {/* Label Prefix - xproduct labelPrefix "数据生产" */}
      <div
        className={`label-prefix ${collapseApp ? 'collapsed' : ''}`}
        onClick={onToggleApp}
      >
        AI Data
      </div>

      {/* Header Right - xproduct headerRight */}
      <div className="header-right">
        {/* Label - xproduct .label */}
        <div className={`header-label ${collapseApp ? 'collapsed' : ''}`}>
          <span className="active-menu-label">
            {currentMenuLabel}
          </span>
        </div>

        {/* Header Menu Container */}
        <section className="header-menu-container">
          <TreeSelect
            showSearch
            value={searchValue}
            placeholder="Search menu..."
            treeData={searchTreeData}
            treeIcon
            treeDefaultExpandAll
            treeNodeFilterProp="title"
            allowClear
            style={{ width: 250, flexShrink: 0 }}
            onChange={(value: string) => {
              setSearchValue(undefined)
              if (value && !value.startsWith('group-')) {
                onSearchNavigate?.(value)
              }
            }}
          />

          {/* Horizontal Nav Menu - antd Menu */}
          {headerNavItems.length > 0 && (
            <Menu
              mode="horizontal"
              selectedKeys={activeNavKey ? [activeNavKey] : []}
              items={headerNavItems.map((item) => ({
                key: item.key,
                label: item.label,
              }))}
              onClick={({ key }) => onNavItemClick?.(key)}
              className="header-nav-menu"
              style={{ flex: 1, borderBottom: 'none', background: 'transparent' }}
            />
          )}
        </section>

        {/* Action Buttons - antd Button type="link" */}
        <Space size={0}>
          <Button
            type="link"
            icon={<QuestionCircleOutlined />}
            onClick={() => window.open('/help', '_blank')}
          >
            Help
          </Button>
          <Button
            type="link"
            icon={<BugOutlined />}
            onClick={() => window.open('/feedback', '_blank')}
          >
            Feedback
          </Button>
          <Button
            type="link"
            icon={<MessageOutlined />}
            onClick={() => window.open('/contact', '_blank')}
          >
            Contact
          </Button>
        </Space>

        {/* Avatar Section - xproduct Dropdown > <section className={styles.avatarSection}> */}
        <Dropdown
          menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
          trigger={['click']}
          placement="bottomRight"
        >
          <div className="avatar-section">
            <span className="avatar-name">Admin</span>
            <Avatar size={32} icon={<UserOutlined />} />
          </div>
        </Dropdown>
      </div>
    </header>
  )
}
