import type { ReactNode } from 'react'
import { Space, Typography } from 'antd'

const { Text } = Typography

/** 4 个 role 各有专属配色 + 图标，让用户一眼区分当前看的是哪一段。
 *  色板用 antd palette 内置色，与 Tag 等组件天然协调。 */
export type OverviewRole = 'overview' | 'manager' | 'de' | 'mle'

const ROLE_THEME: Record<OverviewRole, { color: string; bg: string }> = {
  overview: { color: '#1677ff', bg: 'rgba(22, 119, 255, 0.06)' },  // antd blue
  manager:  { color: '#2f54eb', bg: 'rgba(47, 84, 235, 0.06)' },   // geekblue
  de:       { color: '#fa541c', bg: 'rgba(250, 84, 28, 0.06)' },   // volcano
  mle:      { color: '#13c2c2', bg: 'rgba(19, 194, 194, 0.06)' },  // cyan
}

interface Props {
  role: OverviewRole
  icon: ReactNode
  title: string
  subtitle: string
}

export function SectionHeader({ role, icon, title, subtitle }: Props) {
  const theme = ROLE_THEME[role]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        marginBottom: 12,
        marginTop: 8,
        background: theme.bg,
        borderLeft: `4px solid ${theme.color}`,
        borderRadius: 6,
      }}
    >
      <span style={{ fontSize: 22, color: theme.color, lineHeight: 1, display: 'inline-flex' }}>
        {icon}
      </span>
      <Space direction="vertical" size={0} style={{ minWidth: 0, flex: 1 }}>
        <Text strong style={{ fontSize: 15, color: theme.color }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {subtitle}
        </Text>
      </Space>
    </div>
  )
}
