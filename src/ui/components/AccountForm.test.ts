// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { AccountForm } from './AccountForm.tsx';

describe('AccountForm institutions', () => {
  it('offers exactly Mercado Pago and Outros bancos as institution choices', () => {
    render(
      createElement(AccountForm, {
        onSubmit: () => undefined,
        onCancel: () => undefined,
      }),
    );

    const select = screen.getByLabelText('Institution');
    const options = within(select)
      .getAllByRole('option')
      .map((opt) => opt.textContent?.trim());

    expect(options).toEqual(['Outros bancos', 'Mercado Pago']);
    expect(options).toHaveLength(2);
  });
});
