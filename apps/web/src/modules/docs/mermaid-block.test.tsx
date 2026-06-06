import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const renderMock = vi.fn()
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: (...a: unknown[]) => renderMock(...a),
  },
}))

import { MermaidBlock } from './components/mermaid-block'

afterEach(() => vi.clearAllMocks())

describe('MermaidBlock', () => {
  it('renders the diagram SVG returned by mermaid', async () => {
    renderMock.mockResolvedValue({ svg: '<svg><rect /></svg>', bindFunctions: vi.fn() })
    const { container } = render(<MermaidBlock code="graph TD; A-->B" />)
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
    expect(renderMock).toHaveBeenCalled()
  })

  it('opens the fullscreen modal', async () => {
    renderMock.mockResolvedValue({ svg: '<svg></svg>' })
    render(<MermaidBlock code="graph TD; A-->B" />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    fireEvent.click(screen.getByLabelText('Expand diagram'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy())
  })

  it('shows an error fallback when render fails', async () => {
    renderMock.mockRejectedValue(new Error('bad syntax'))
    render(<MermaidBlock code="not-a-diagram" />)
    await waitFor(() => expect(screen.getByText('Mermaid 渲染失败')).toBeInTheDocument())
    expect(screen.getByText('bad syntax')).toBeInTheDocument()
  })
})
