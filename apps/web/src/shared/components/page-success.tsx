import { useEffect, useState } from 'react'
import { Alert } from 'antd'

interface PageSuccessProps {
  message: string
  onDismiss: () => void
  autoCloseDuration?: number
}

export function PageSuccess({ message, onDismiss, autoCloseDuration = 3000 }: PageSuccessProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (autoCloseDuration > 0) {
      const timer = setTimeout(() => setVisible(false), autoCloseDuration)
      return () => clearTimeout(timer)
    }
  }, [autoCloseDuration])

  if (!visible) return null

  return (
    <Alert
      message={message}
      type="success"
      showIcon
      closable
      onClose={onDismiss}
      style={{ marginBottom: 16 }}
    />
  )
}
