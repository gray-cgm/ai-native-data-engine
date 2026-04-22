import { createElement } from 'react'
import { SettingOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import '../../../styles/layout-micro-menu.css'
import type { NavGroup } from '../nav-config'

interface LayoutMicroMenuProps {
  groups: NavGroup[]
  activeIndex: number
  collapsed: boolean
  onGroupChange: (index: number) => void
  settingsActive?: boolean
  onSettingsClick?: () => void
}

export function LayoutMicroMenu({
  groups,
  activeIndex,
  collapsed,
  onGroupChange,
  settingsActive,
  onSettingsClick,
}: LayoutMicroMenuProps) {
  return (
    <aside className={`layout-micro-menu ${collapsed ? 'collapsed' : ''}`}>
      <div className="micro-menu-wrap">
        <div className="micro-app-list">
          {groups.map((group, index) => (
            <button
              key={group.label}
              className={`micro-app-item ${index === activeIndex ? 'active' : ''}`}
              onClick={() => onGroupChange(index)}
              title={group.label}
            >
              <div className="icon-container">
                <span className="item-icon">{createElement(group.icon)}</span>
              </div>
              <span className="item-label">{group.label}</span>
            </button>
          ))}
        </div>

        {/* System menu section at the bottom */}
        <div className="system-menu-list">
            <Button
              type="text"
              block
              icon={<SettingOutlined />}
              className={`system-menu-item ${settingsActive ? 'active' : ''}`}
              onClick={onSettingsClick}
            >
              Settings
            </Button>
        </div>
      </div>
    </aside>
  )
}
