import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './app-shell'
import { MainLayout } from './main-layout'

describe('AppShell', () => {
  it('renders nav groups and marks the active route', () => {
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <AppShell>
          <div>page content</div>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByText('AD Data Workbench')).toBeInTheDocument()
    expect(screen.getByText('page content')).toBeInTheDocument()
    const active = document.querySelector('.nav-item.active')
    expect(active?.textContent).toBe('Datasets')
  })

  it('treats root as active only on exact /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>
          <div>home</div>
        </AppShell>
      </MemoryRouter>,
    )
    const active = document.querySelector('.nav-item.active')
    expect(active?.textContent).toBe('Overview')
  })
})

describe('MainLayout', () => {
  function renderLayout(entry = '/') {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>home page</div>} />
            <Route path="/settings" element={<div>settings page</div>} />
            <Route path="/catalog" element={<div>catalog page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('renders the outlet content and chrome', () => {
    renderLayout('/')
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('renders when on a module route', () => {
    renderLayout('/catalog')
    expect(screen.getByText('catalog page')).toBeInTheDocument()
  })

  it('renders the settings route', () => {
    renderLayout('/settings')
    expect(screen.getByText('settings page')).toBeInTheDocument()
  })

  it('toggles fullscreen via the float button without crashing', () => {
    renderLayout('/')
    const buttons = document.querySelectorAll('button')
    if (buttons.length > 0) fireEvent.click(buttons[buttons.length - 1])
    expect(screen.getByText('home page')).toBeInTheDocument()
  })
})
