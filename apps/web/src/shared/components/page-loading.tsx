import { Spin } from 'antd'

interface PageLoadingProps {
  message?: string
}

export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
      <Spin size="large" tip={message}>
        <div style={{ padding: 48 }} />
      </Spin>
    </div>
  )
}
