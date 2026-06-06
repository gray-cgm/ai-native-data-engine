import {
  AngleTool,
  ArrowAnnotateTool,
  BidirectionalTool,
  CircleROITool,
  EllipticalROITool,
  LengthTool,
  PanTool,
  PlanarFreehandROITool,
  ProbeTool,
  RectangleROITool,
  StackScrollTool,
  WindowLevelTool,
  ZoomTool,
} from '@cornerstonejs/tools'

// 标注工具目录——toolbar 渲染按钮、useCornerstone 注册工具都从这里读，单一来源。
// `primary` 类工具互斥（绑左键，一次只激活一个）；`navigation` 类常驻其它鼠标键。

export type ToolCategory = 'annotation' | 'navigation'

export interface ToolSpec {
  /** cornerstone3D 的 toolName（即各 Tool 类的 static toolName） */
  name: string
  label: string
  category: ToolCategory
  /** antd 图标名（在 toolbar 里映射成具体 icon 组件） */
  icon: string
  hint?: string
}

// 互斥的标注工具（绑左键 Primary）
export const ANNOTATION_TOOLS: ToolSpec[] = [
  { name: RectangleROITool.toolName, label: '矩形框', category: 'annotation', icon: 'border', hint: 'Rectangle ROI · 目标级 bbox' },
  { name: EllipticalROITool.toolName, label: '椭圆', category: 'annotation', icon: 'ellipsis', hint: 'Elliptical ROI' },
  { name: CircleROITool.toolName, label: '圆形', category: 'annotation', icon: 'loading3-quarters', hint: 'Circle ROI' },
  { name: PlanarFreehandROITool.toolName, label: '自由勾画', category: 'annotation', icon: 'edit', hint: 'Freehand 分割轮廓' },
  { name: LengthTool.toolName, label: '长度', category: 'annotation', icon: 'line', hint: 'Length 测量' },
  { name: AngleTool.toolName, label: '角度', category: 'annotation', icon: 'radius-upright', hint: 'Angle 测量' },
  { name: BidirectionalTool.toolName, label: '双向', category: 'annotation', icon: 'fullscreen', hint: 'Bidirectional 长短轴' },
  { name: ProbeTool.toolName, label: '探针', category: 'annotation', icon: 'aim', hint: 'Probe 取点' },
  { name: ArrowAnnotateTool.toolName, label: '箭头标注', category: 'annotation', icon: 'arrow-right', hint: 'Arrow + 文本' },
]

// 导航工具（常驻其它鼠标键，不进互斥组）
export const NAVIGATION_TOOLS: ToolSpec[] = [
  { name: WindowLevelTool.toolName, label: '窗宽窗位', category: 'navigation', icon: 'bulb', hint: '左键拖动调 W/L' },
  { name: PanTool.toolName, label: '平移', category: 'navigation', icon: 'drag', hint: '中键拖动' },
  { name: ZoomTool.toolName, label: '缩放', category: 'navigation', icon: 'zoom-in', hint: '右键拖动' },
  { name: StackScrollTool.toolName, label: '翻帧', category: 'navigation', icon: 'switcher', hint: '滚轮切换 stack 帧' },
]

export const ALL_TOOLS: ToolSpec[] = [...ANNOTATION_TOOLS, ...NAVIGATION_TOOLS]

/** 工具类列表——useCornerstone 用它做全局 addTool 注册 */
export const TOOL_CLASSES = [
  RectangleROITool,
  EllipticalROITool,
  CircleROITool,
  PlanarFreehandROITool,
  LengthTool,
  AngleTool,
  BidirectionalTool,
  ProbeTool,
  ArrowAnnotateTool,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  StackScrollTool,
]

export const DEFAULT_PRIMARY_TOOL = RectangleROITool.toolName
