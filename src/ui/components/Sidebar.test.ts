// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';

function renderSidebar() {
  render(createElement(MemoryRouter, null, createElement(Sidebar)));
}

describe('Sidebar version', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows dev below the vault badge when no deploy number is set', () => {
    renderSidebar();
    const sidebar = screen.getByRole('complementary');
    const version = within(sidebar).getByText('dev');
    const badge = within(sidebar).getByText('Encrypted');
    expect(version).toBeTruthy();
    expect(badge.compareDocumentPosition(version) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(sidebar).queryByRole('link', { name: 'dev' })).toBeNull();
  });

  it('shows the deploy run number below the vault badge', () => {
    vi.stubEnv('VITE_APP_VERSION', '42');
    renderSidebar();
    const sidebar = screen.getByRole('complementary');
    const version = within(sidebar).getByText('v1.42.0');
    const badge = within(sidebar).getByText('Encrypted');
    expect(badge.compareDocumentPosition(version) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
