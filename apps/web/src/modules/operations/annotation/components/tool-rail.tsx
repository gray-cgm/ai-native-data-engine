import { Button, Divider, Tooltip } from 'antd'
import {
  AimOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  BorderOutlined,
  BulbOutlined,
  ClearOutlined,
  EditOutlined,
  ExpandOutlined,
  FullscreenOutlined,
  LineOutlined,
  Loading3QuartersOutlined,
  RadiusUprightOutlined,
} from '@ant-design/icons'
import { WindowLevelTool } from '@cornerstonejs/tools'
import { ANNOTATION_TOOLS, NAVIGATION_TOOLS, type ToolSpec } from '../tools'
import type { UseCornerstoneResult } from '../use-cornerstone'

const ICONS: Record<string, React.ComponentType> = {
  border: BorderOutlined,
  ellipsis: ExpandOutlined,
  'loading3-quarters': Loading3QuartersOutlined,
  edit: EditOutlined,
  line: LineOutlined,
  'radius-upright': RadiusUprightOutlined,
  fullscreen: FullscreenOutlined,
  aim: AimOutlined,
  'arrow-right': ArrowRightOutlined,
  bulb: BulbOutlined,
}

function Icon({ name }: { name: string }) {
  const Cmp = ICONS[name] ?? AppstoreOutlined
  return <Cmp />
}

interface Props {
  cs: UseCornerstoneResult
}

// 左侧竖排工具栏（Photoshop 式）：纯图标 + 右侧 tooltip。
// 标注工具 + 窗宽窗位占左键互斥槽；底部是视图动作。
export function ToolRail({ cs }: Props) {
  const disabled = !cs.ready
  const windowLevel = NAVIGATION_TOOLS.find((t) => t.name === WindowLevelTool.toolName)

  const ToolBtn = ({ spec }: { spec: ToolSpec }) => {
    const active = cs.activeTool === spec.name
    return (
      <Tooltip placement="right" title={spec.hint ?? spec.label}>
        <Button
          type={active ? 'primary' : 'text'}
          icon={<Icon name={spec.icon} />}
          disabled={disabled}
          onClick={() => cs.setActiveTool(spec.name)}
          style={{ width: 40, height: 40 }}
        />
      </Tooltip>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 6px',
        background: '#fafafa',
        borderRight: '1px solid #f0f0f0',
        width: 56,
        flexShrink: 0,
      }}
    >
      {ANNOTATION_TOOLS.map((spec) => (
        <ToolBtn key={spec.name} spec={spec} />
      ))}

      <Divider style={{ margin: '6px 0', minWidth: 36, width: 36 }} />

      {windowLevel && <ToolBtn spec={windowLevel} />}

      <div style={{ flex: 1 }} />

      <Tooltip placement="right" title="重置缩放/平移">
        <Button
          type="text"
          icon={<FullscreenOutlined />}
          disabled={disabled}
          onClick={cs.resetView}
          style={{ width: 40, height: 40 }}
        />
      </Tooltip>
      <Tooltip placement="right" title="清空当前帧所有标注">
        <Button
          type="text"
          danger
          icon={<ClearOutlined />}
          disabled={disabled || cs.annotations.length === 0}
          onClick={cs.clearAnnotations}
          style={{ width: 40, height: 40 }}
        />
      </Tooltip>
    </div>
  )
}
