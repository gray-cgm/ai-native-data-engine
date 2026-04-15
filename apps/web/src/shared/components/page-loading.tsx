interface PageLoadingProps {
  message?: string
}

export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <div className="page-loading" style={{ textAlign: 'center', padding: '48px' }}>
      <p className="text-muted">{message}</p>
    </div>
  )
}
