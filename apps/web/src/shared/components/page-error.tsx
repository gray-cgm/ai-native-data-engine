import { Result, Button } from 'antd'

interface PageErrorProps {
  message?: string
  onRetry?: () => void
}

export function PageError({ message, onRetry }: PageErrorProps) {
  return (
    <Result
      status="error"
      title="Unable to load content"
      subTitle={message || 'An error occurred while loading data.'}
      extra={
        onRetry ? (
          <Button type="primary" onClick={onRetry}>
            Try Again
          </Button>
        ) : undefined
      }
    />
  )
}
