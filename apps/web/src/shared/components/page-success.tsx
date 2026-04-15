interface PageSuccessProps {
  message: string
  onDismiss: () => void
  autoCloseDuration?: number
}

export function PageSuccess({ message, onDismiss, autoCloseDuration = 3000 }: PageSuccessProps) {
  // Auto-dismiss after duration
  if (autoCloseDuration > 0) {
    setTimeout(onDismiss, autoCloseDuration)
  }

  return (
    <div
      className="page-success"
      style={{
        backgroundColor: '#d4edda',
        border: '1px solid #c3e6cb',
        color: '#155724',
        padding: 'var(--space-md)',
        borderRadius: '4px',
        marginBottom: 'var(--space-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: '1.5em',
          color: '#155724',
        }}
      >
        ✕
      </button>
    </div>
  )
}
