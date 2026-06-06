import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { PageSuccess } from './page-success'

describe('PageSuccess', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('auto-hides after the duration', () => {
    render(<PageSuccess message="saved" onDismiss={() => {}} autoCloseDuration={1000} />)
    expect(screen.getByText('saved')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('saved')).not.toBeInTheDocument()
  })

  it('stays visible when autoCloseDuration is 0', () => {
    render(<PageSuccess message="persist" onDismiss={() => {}} autoCloseDuration={0} />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('persist')).toBeInTheDocument()
  })
})
