import { Link } from 'react-router-dom'
import { Button } from 'antd'
import { HighlightOutlined } from '@ant-design/icons'
import { OpsModuleListPage } from '../components/ops-module-list-page'

export default function LabelingPage() {
  return (
    <OpsModuleListPage
      module="labeling"
      extraRowActions={(row) => {
        const params = new URLSearchParams()
        params.set('ops_item', row.id)
        if (row.x_trace_id) params.set('trace', row.x_trace_id)
        if (row.clip_ids[0]) params.set('clip', row.clip_ids[0])
        return (
          <Link to={`/ops/labeling/annotate?${params.toString()}`}>
            <Button size="small" type="link" icon={<HighlightOutlined />}>
              标注
            </Button>
          </Link>
        )
      }}
    />
  )
}
