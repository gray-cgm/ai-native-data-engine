import '../../../styles/layout-micro-menu.css'
import type { NavGroup } from '../nav-config'

interface LayoutMicroMenuProps {
  groups: NavGroup[]
  activeIndex: number
  collapsed: boolean
  onGroupChange: (index: number) => void
}

export function LayoutMicroMenu({
  groups,
  activeIndex,
  collapsed,
  onGroupChange,
}: LayoutMicroMenuProps) {
  return (
    <aside className={`layout-micro-menu ${collapsed ? 'collapsed' : ''}`}>
      <div className="micro-menu-content">
        {groups.map((group, index) => (
          <button
            key={group.label}
            className={`micro-app-item ${index === activeIndex ? 'active' : ''}`}
            onClick={() => onGroupChange(index)}
            title={group.label}
          >
            <span className="icon">{group.icon}</span>
            <span className="label">{group.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
