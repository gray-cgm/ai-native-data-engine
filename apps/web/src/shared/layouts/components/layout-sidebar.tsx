import '../../../styles/layout-sidebar.css'
import type { NavItem } from '../nav-config'

interface LayoutSidebarProps {
  items: NavItem[]
  currentPath: string
  collapsed: boolean
  onNavClick: (path: string) => void
}

export function LayoutSidebar({
  items,
  currentPath,
  collapsed,
  onNavClick,
}: LayoutSidebarProps) {
  const activePath = items
    .filter((item) => {
      if (item.path === '/') return currentPath === '/'
      return currentPath === item.path || currentPath.startsWith(item.path + '/')
    })
    .sort((a, b) => b.path.length - a.path.length)[0]?.path

  function isActive(path: string) {
    return path === activePath
  }

  return (
    <aside className={`layout-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <nav className="sidebar-nav">
        <div className="nav-items">
          {items.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => onNavClick(item.path)}
              title={item.label}
            >
              <span className="nav-item-text">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  )
}
