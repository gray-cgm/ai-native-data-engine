import { Badge, Button, Card, Empty, List, Space, Tag, Typography } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { UseCornerstoneResult } from '../use-cornerstone'

const { Text } = Typography

// 工具名 → 中文短标签 + 颜色，给标注对象列表用
const TOOL_TAG: Record<string, { label: string; color: string }> = {
  RectangleROI: { label: '矩形', color: 'blue' },
  EllipticalROI: { label: '椭圆', color: 'cyan' },
  CircleROI: { label: '圆形', color: 'geekblue' },
  PlanarFreehandROI: { label: '勾画', color: 'purple' },
  Length: { label: '长度', color: 'green' },
  Angle: { label: '角度', color: 'lime' },
  Bidirectional: { label: '双向', color: 'gold' },
  Probe: { label: '探针', color: 'orange' },
  ArrowAnnotate: { label: '箭头', color: 'magenta' },
}

interface Props {
  cs: UseCornerstoneResult
}

// 右侧 sidebar：列出当前 viewport 上的标注对象，支持选中 / 删除。
// 后续接入真实 labeling 任务时，这里挂分类下拉 / 属性表单 / 提交按钮。
export function AnnotationSidebar({ cs }: Props) {
  return (
    <Card
      size="small"
      title={
        <Space>
          <span>标注对象</span>
          <Badge count={cs.annotations.length} showZero color="#1677ff" />
        </Space>
      }
      variant="borderless"
      styles={{ body: { padding: cs.annotations.length ? '0 0 8px' : 24, overflow: 'auto' } }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}
    >
      {cs.annotations.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有标注，选工具后在图上拖动创建" />
      ) : (
        <List
          size="small"
          dataSource={cs.annotations}
          renderItem={(item, idx) => {
            const meta = TOOL_TAG[item.toolName] ?? { label: item.toolName, color: 'default' }
            return (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background: item.selected ? '#e6f4ff' : undefined,
                  padding: '6px 12px',
                }}
                onClick={() => cs.selectAnnotation(item.uid)}
                actions={[
                  <Button
                    key="del"
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      cs.removeAnnotation(item.uid)
                    }}
                  />,
                ]}
              >
                <Space size={8}>
                  <Text type="secondary" style={{ fontSize: 12, width: 20 }}>
                    #{idx + 1}
                  </Text>
                  <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>
                    {meta.label}
                  </Tag>
                  <Text style={{ fontSize: 12 }} ellipsis title={item.uid}>
                    {item.label}
                  </Text>
                </Space>
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}
