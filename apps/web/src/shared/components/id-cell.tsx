import { Tooltip, Typography } from 'antd'

const { Text } = Typography

interface IdCellProps {
  /** The full id string. */
  value: string | null | undefined
  /**
   * Display style:
   * - 'short' (default): show first `head` chars + `…`, copy hidden until row hover
   * - 'full':            show full value (use when col is wide enough)
   * - 'mono-ellipsis':   show full with monospace + CSS ellipsis (cell-width clamped)
   */
  variant?: 'short' | 'full' | 'mono-ellipsis'
  /** Leading chars to show in 'short' variant. Default: 8 */
  head?: number
  /** Placeholder when value is missing. */
  placeholder?: string
  /** Optional CSS max-width for the text portion (mono-ellipsis variant). */
  maxWidth?: number | string
}

/**
 * Compact id cell for tables. Always renders a copy button (antd Typography
 * copyable). The visible text is truncated; full id is in the Tooltip and
 * goes on the clipboard. The copy button is `data-stop-row-click` so the
 * shared DataTable's row-click handler skips it.
 *
 * Use everywhere an id (UUID / x_trace_id / dataset_id / clip_id / run_id …)
 * appears in a table cell.
 */
export function IdCell({
  value,
  variant = 'short',
  head = 8,
  placeholder = '—',
  maxWidth,
}: IdCellProps) {
  if (!value) {
    return <Text type="secondary">{placeholder}</Text>
  }

  const display =
    variant === 'short' && value.length > head
      ? `${value.slice(0, head)}…`
      : value

  const style: React.CSSProperties = {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
  }
  if (variant === 'mono-ellipsis' && maxWidth != null) {
    Object.assign(style, {
      display: 'inline-block',
      maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'bottom',
    })
  }

  return (
    <span data-stop-row-click style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <Tooltip title={value} placement="topLeft" mouseEnterDelay={0.3}>
        <span style={style}>{display}</span>
      </Tooltip>
      <Text
        copyable={{
          text: value,
          tooltips: ['复制', '已复制'],
        }}
        style={{ marginInlineStart: 0 }}
      />
    </span>
  )
}
