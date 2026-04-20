interface RequirementFiltersProps {
  status: string
  priority: string
  keyword: string
  onStatusChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onKeywordChange: (value: string) => void
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function RequirementFilters({
  status,
  priority,
  keyword,
  onStatusChange,
  onPriorityChange,
  onKeywordChange,
}: RequirementFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-input)',
          background: 'var(--color-bg-input)',
          fontSize: 'var(--font-size-base)',
          minWidth: 140,
        }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-input)',
          background: 'var(--color-bg-input)',
          fontSize: 'var(--font-size-base)',
          minWidth: 140,
        }}
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder="Search by title..."
        style={{ flex: 1, minWidth: 200 }}
      />
    </div>
  )
}
