import { EXTENSION_SOURCE_URL } from '../extension-unavailable.ts';

/**
 * Install steps for the companion extension. Shown only when Mercado Pago
 * import fails because the browser has no extension to connect to.
 */
export function ExtensionInstallGuidance() {
  return (
    <div
      data-testid="mp-extension-install"
      className="rounded-xl border border-mtt-border bg-mtt-bg p-5 space-y-3 mb-4"
    >
      <h4 className="text-sm font-semibold text-mtt-fg">
        Install the mytruetrack Import extension
      </h4>
      <p className="text-xs leading-relaxed text-mtt-muted">
        Mercado Pago import uses the mytruetrack Import extension in this Chrome or Edge profile.
        Install it, then choose Sign in to Mercado Pago again.
      </p>
      <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-mtt-fg">
        <li>
          Open <code className="font-mono">chrome://extensions</code> in Chrome, or{' '}
          <code className="font-mono">edge://extensions</code> in Edge.
        </li>
        <li>Turn on Developer mode.</li>
        <li>
          Choose Load unpacked and select the <code className="font-mono">extension</code> folder
          from the mytruetrack project. The card name is mytruetrack Import.
        </li>
        <li>Return to this dialog and start the import again.</li>
      </ol>
      <p className="text-xs">
        <a
          href={EXTENSION_SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-mtt-accent underline"
        >
          Extension folder on GitHub
        </a>
      </p>
    </div>
  );
}
