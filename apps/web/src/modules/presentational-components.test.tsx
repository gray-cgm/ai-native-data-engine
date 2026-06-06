import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SectionHeader } from './overview/components/section-header'
import { ToolCard } from './tools/components/tool-card'
import { ClipProgressBar } from './explorer/components/clip-progress-bar'
import { RequirementStatsBar } from './requirements/components/requirement-stats'
import { RequirementFilters } from './requirements/components/requirement-filters'
import type { ToolDescriptor } from '@/shared/microfrontends/types'

describe('SectionHeader', () => {
  it('renders title, subtitle and per-role icon', () => {
    render(<SectionHeader role="de" icon={<span>ICON</span>} title="DE" subtitle="data eng" />)
    expect(screen.getByText('DE')).toBeInTheDocument()
    expect(screen.getByText('data eng')).toBeInTheDocument()
    expect(screen.getByText('ICON')).toBeInTheDocument()
  })
})

const tool: ToolDescriptor = {
  id: 'dagster',
  name: 'Dagster',
  shortName: 'Dagster',
  icon: 'DR',
  category: 'orchestration',
  summary: 'orchestration summary',
  description: 'long description',
  integrationMode: 'direct-iframe',
  baseUrl: 'http://localhost:3001',
  gatewayPath: '/gw',
  healthPath: '/h',
  workspacePath: '/tools/dagster',
  capabilities: ['Cap A', 'Cap B', 'Cap C', 'Cap D'],
  useCases: [],
  route: { path: '/tools/dagster', label: 'Dagster' },
}

describe('ToolCard', () => {
  it('renders metadata and caps the capability list at three', () => {
    render(
      <MemoryRouter>
        <ToolCard tool={tool} />
      </MemoryRouter>,
    )
    expect(screen.getByText('orchestration summary')).toBeInTheDocument()
    expect(screen.getByText('orchestration')).toBeInTheDocument()
    expect(screen.getByText('Cap A')).toBeInTheDocument()
    expect(screen.getByText('Cap C')).toBeInTheDocument()
    expect(screen.queryByText('Cap D')).not.toBeInTheDocument()
    expect(screen.getByText('Open workspace')).toBeInTheDocument()
  })
})

describe('ClipProgressBar', () => {
  it('renders fallback for invalid window', () => {
    render(<ClipProgressBar startNs={null} endNs={null} />)
    expect(screen.getByText(/no time window/)).toBeInTheDocument()
  })
  it('renders fallback when end <= start', () => {
    render(<ClipProgressBar startNs={100} endNs={50} />)
    expect(screen.getByText(/no time window/)).toBeInTheDocument()
  })
  it('renders a valid compact window with start/end time labels', () => {
    const { container } = render(<ClipProgressBar startNs={0} endNs={5e9} />)
    // compact mode shows start + end wall-clock labels, no offset
    expect(container.textContent).toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(container.textContent).not.toMatch(/no time window/)
  })
  it('renders detailed window with now marker', () => {
    const { container } = render(
      <ClipProgressBar startNs={0} endNs={120e9} nowNs={60e9} size="detailed" />,
    )
    expect(container.textContent).toMatch(/\+/)
  })
})

describe('RequirementStatsBar', () => {
  it('renders defaults when nested maps are missing', () => {
    render(<RequirementStatsBar stats={{ total: 12, by_status: {}, by_priority: {}, by_source: {} }} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('High Priority')).toBeInTheDocument()
  })
})

describe('RequirementFilters', () => {
  it('fires keyword change handler on typing', () => {
    const onKeywordChange = vi.fn()
    render(
      <RequirementFilters
        status=""
        priority=""
        keyword=""
        onStatusChange={() => {}}
        onPriorityChange={() => {}}
        onKeywordChange={onKeywordChange}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Search by title...'), { target: { value: 'lane' } })
    expect(onKeywordChange).toHaveBeenCalledWith('lane')
  })
})
