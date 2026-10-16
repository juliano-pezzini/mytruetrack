// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { DatabaseContext } from '../../app/database-provider.tsx';
import type { Database } from '../../storage/database.ts';
import type { AccountImportLog } from '../../storage/repositories/account-import-log-repository.ts';

const mockNotifyChange = vi.fn();
const mockListByAccount = vi.fn();
const mockDeleteAccountImportRun = vi.fn();

const mpImport = vi.hoisted(() => ({
  status: 'idle' as string,
  summary: null as null,
  error: null as string | null,
  startImport: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../hooks/useAutoSync.ts', () => ({
  useAutoSync: () => ({ status: 'idle', notifyChange: mockNotifyChange }),
}));

vi.mock('../hooks/useMercadoPagoImport.ts', () => ({
  todaySaoPauloDate: () => '2026-10-13',
  useMercadoPagoImport: () => mpImport,
}));

vi.mock('../../storage/repositories/account-import-log-repository.ts', () => ({
  createAccountImportLogRepository: () => ({
    listByAccount: mockListByAccount,
  }),
}));

vi.mock('../../workers/delete-account-import-run.ts', () => ({
  deleteAccountImportRun: (...args: unknown[]) => mockDeleteAccountImportRun(...args),
}));

import { MercadoPagoImportModal } from './MercadoPagoImportModal.tsx';
import {
  EXTENSION_UNAVAILABLE_MESSAGE,
  EXTENSION_ZIP_NAME,
  extensionZipHref,
} from '../extension-unavailable.ts';

const SAMPLE_LOG: AccountImportLog = {
  id: 'run-list-1',
  accountId: 'acc-mp',
  source: 'mercado_pago',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  importedAt: '2026-02-01T15:30:00.000Z',
  importedCount: 3,
  skippedCount: 1,
  errorCount: 2,
};

describe('MercadoPagoImportModal', () => {
  const fakeDb = {} as Database;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(DatabaseContext.Provider, { value: fakeDb }, children);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mpImport.status = 'idle';
    mpImport.summary = null;
    mpImport.error = null;
    mockListByAccount.mockResolvedValue([SAMPLE_LOG]);
    mockDeleteAccountImportRun.mockResolvedValue(undefined);
  });

  it('lists mercado_pago import runs with period, time, and counts', async () => {
    render(
      createElement(MercadoPagoImportModal, {
        accountId: 'acc-mp',
        accountName: 'MP Wallet',
        onClose: vi.fn(),
      }),
      { wrapper },
    );

    const list = await screen.findByTestId('mp-import-runs');
    expect(mockListByAccount).toHaveBeenCalledWith('acc-mp', 'mercado_pago');
    expect(within(list).getByText(/2026-01-01 → 2026-01-31/)).toBeTruthy();
    expect(within(list).getByText(/3 imported/)).toBeTruthy();
    expect(within(list).getByText(/1 skipped/)).toBeTruthy();
    expect(within(list).getByText(/2 errors/)).toBeTruthy();
    expect(list.textContent).toMatch(/2026/);
  });

  it('asks for a normal confirm without typed DELETE; dismiss leaves the log', async () => {
    render(
      createElement(MercadoPagoImportModal, {
        accountId: 'acc-mp',
        accountName: 'MP Wallet',
        onClose: vi.fn(),
      }),
      { wrapper },
    );

    await screen.findByTestId('mp-import-runs');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete import run')).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/\bDELETE\b/);
    expect(within(dialog).queryByRole('textbox')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    expect(mockDeleteAccountImportRun).not.toHaveBeenCalled();
    expect(mockNotifyChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('mp-import-runs')).toBeTruthy();
    expect(
      within(screen.getByTestId('mp-import-runs')).getByText(/2026-01-01 → 2026-01-31/),
    ).toBeTruthy();
  });

  it('confirm delete calls deleteAccountImportRun and notifyChange', async () => {
    const onImported = vi.fn();
    mockListByAccount.mockResolvedValueOnce([SAMPLE_LOG]).mockResolvedValueOnce([]);

    render(
      createElement(MercadoPagoImportModal, {
        accountId: 'acc-mp',
        accountName: 'MP Wallet',
        onClose: vi.fn(),
        onImported,
      }),
      { wrapper },
    );

    await screen.findByTestId('mp-import-runs');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteAccountImportRun).toHaveBeenCalledWith(fakeDb, 'run-list-1');
    });
    expect(mockNotifyChange).toHaveBeenCalled();
    await waitFor(() => {
      expect(onImported).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/No Mercado Pago imports yet/i)).toBeTruthy();
    });
  });

  it('shows install steps when the companion extension is missing', async () => {
    mpImport.status = 'error';
    mpImport.error = EXTENSION_UNAVAILABLE_MESSAGE;

    render(
      createElement(MercadoPagoImportModal, {
        accountId: 'acc-mp',
        accountName: 'MP Wallet',
        onClose: vi.fn(),
      }),
      { wrapper },
    );

    const error = await screen.findByTestId('mp-import-error');
    expect(error.textContent).toBe(EXTENSION_UNAVAILABLE_MESSAGE);

    const guide = screen.getByTestId('mp-extension-install');
    expect(guide.textContent).toMatch(/Install the mytruetrack Import extension/);
    expect(guide.textContent).toMatch(/chrome:\/\/extensions/);
    expect(guide.textContent).toMatch(/edge:\/\/extensions/);
    expect(guide.textContent).toMatch(/Developer mode/);
    expect(guide.textContent).toMatch(/Load unpacked/);
    expect(guide.textContent).toMatch(/extension/);
    const link = screen.getByRole('link', { name: 'Download the extension (.zip)' });
    expect(link.getAttribute('href')).toBe(extensionZipHref());
    expect(link.getAttribute('download')).toBe(EXTENSION_ZIP_NAME);
  });

  it('keeps other import errors free of install steps', async () => {
    mpImport.status = 'error';
    mpImport.error = 'Page 2 failed';

    render(
      createElement(MercadoPagoImportModal, {
        accountId: 'acc-mp',
        accountName: 'MP Wallet',
        onClose: vi.fn(),
      }),
      { wrapper },
    );

    const error = await screen.findByTestId('mp-import-error');
    expect(error.textContent).toBe('Page 2 failed');
    expect(screen.queryByTestId('mp-extension-install')).toBeNull();
  });
});
