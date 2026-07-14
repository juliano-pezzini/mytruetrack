import { useState, useEffect } from 'react';
import { useVault } from '../hooks/useVault.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { PassphraseInput } from './PassphraseInput.tsx';
import { hasKeyData, loadKeyData, saveKeyData } from '../../crypto/key-store.ts';
import {
  generateSalt,
  deriveKek,
  rewrapDek,
  unwrapDekExtractable,
} from '../../crypto/key-derivation.ts';
import {
  isBiometricAvailable,
  hasBiometricUnlock,
  enrollBiometricUnlock,
  removeBiometricCredential,
} from '../../crypto/webauthn.ts';

type SecurityState = {
  readonly vaultProtected: boolean;
  readonly bioAvailable: boolean;
  readonly bioEnrolled: boolean;
};

export function SecuritySection() {
  const { status, reset } = useVault();
  const [state, setState] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change-passphrase form
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  // Enable-biometric form (needs the passphrase to derive an extractable DEK)
  const [showBioForm, setShowBioForm] = useState(false);
  const [bioPassphrase, setBioPassphrase] = useState('');
  const [bioError, setBioError] = useState<string | null>(null);

  async function loadState() {
    const [vaultProtected, bioAvailable, bioEnrolled] = await Promise.all([
      hasKeyData(),
      isBiometricAvailable(),
      hasBiometricUnlock(),
    ]);
    setState({ vaultProtected, bioAvailable, bioEnrolled });
  }

  useEffect(() => {
    void loadState();
  }, [status]);

  async function handleEnableBiometric() {
    if (bioPassphrase.length === 0) {
      setBioError('Enter your passphrase to enable biometric unlock.');
      return;
    }
    setLoading(true);
    setBioError(null);
    setMessage(null);
    try {
      const keyData = await loadKeyData();
      if (!keyData) throw new Error('No vault found.');

      // Derive a transient extractable DEK from the passphrase so it can be
      // re-wrapped for biometric. The app's working DEK stays non-extractable.
      const kek = await deriveKek(bioPassphrase, keyData.salt, keyData.iterations);
      const extractableDek = await unwrapDekExtractable(keyData.wrappedDek, kek);

      const userId = crypto.getRandomValues(new Uint8Array(16));
      await enrollBiometricUnlock(userId, 'mytruetrack', extractableDek);
      setShowBioForm(false);
      setBioPassphrase('');
      setMessage({ type: 'success', text: 'Biometric unlock enabled.' });
      await loadState();
    } catch (err) {
      const isPassphrase = err instanceof Error && err.message.includes('unwrap');
      setBioError(
        isPassphrase ? 'Incorrect passphrase.' : 'Biometric enrollment failed or was cancelled.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveBiometric() {
    setLoading(true);
    setMessage(null);
    try {
      await removeBiometricCredential();
      setMessage({ type: 'success', text: 'Biometric unlock removed.' });
      await loadState();
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove biometric unlock.' });
    } finally {
      setLoading(false);
    }
  }

  function resetChangeForm() {
    setShowChangeForm(false);
    setCurrentPassphrase('');
    setNewPassphrase('');
    setConfirmPassphrase('');
    setChangeError(null);
  }

  async function handleChangePassphrase() {
    if (newPassphrase.length < 8) {
      setChangeError('New passphrase must be at least 8 characters.');
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      setChangeError('New passphrases do not match.');
      return;
    }

    setChangeError(null);
    setChanging(true);
    try {
      const keyData = await loadKeyData();
      if (!keyData) throw new Error('No vault found.');

      const currentKek = await deriveKek(currentPassphrase, keyData.salt, keyData.iterations);
      const newSalt = generateSalt();
      const newKek = await deriveKek(newPassphrase, newSalt);
      const newWrappedDek = await rewrapDek(keyData.wrappedDek, currentKek, newKek);

      await saveKeyData({ wrappedDek: newWrappedDek, salt: newSalt, iterations: 600_000 });
      resetChangeForm();
      setMessage({ type: 'success', text: 'Passphrase changed successfully.' });
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : 'Failed to change passphrase.');
    } finally {
      setChanging(false);
    }
  }

  if (state === null) {
    return <p className="text-sm text-gray-400">Loading security status…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Vault status */}
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            state.vaultProtected ? 'bg-green-500' : 'bg-yellow-400'
          }`}
        />
        <div>
          {state.vaultProtected ? (
            <>
              <p className="text-sm font-medium text-gray-800">Protected with passphrase</p>
              <p className="text-xs text-gray-500 mb-2">
                Your data is encrypted. You need your passphrase to unlock it.
              </p>
              {!showChangeForm ? (
                <button
                  type="button"
                  onClick={() => setShowChangeForm(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Change passphrase…
                </button>
              ) : (
                <div className="mt-3 space-y-3 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-700">Change passphrase</p>
                  <PassphraseInput
                    id="current-passphrase"
                    value={currentPassphrase}
                    onChange={setCurrentPassphrase}
                    label="Current passphrase"
                    autoFocus
                  />
                  <PassphraseInput
                    id="new-passphrase"
                    value={newPassphrase}
                    onChange={setNewPassphrase}
                    label="New passphrase"
                  />
                  <PassphraseInput
                    id="confirm-new-passphrase"
                    value={confirmPassphrase}
                    onChange={setConfirmPassphrase}
                    label="Confirm new passphrase"
                  />
                  {changeError && <p className="text-xs text-red-600">{changeError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleChangePassphrase}
                      disabled={
                        changing || !currentPassphrase || !newPassphrase || !confirmPassphrase
                      }
                      className="flex-1 py-2 px-3 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {changing ? 'Saving…' : 'Save new passphrase'}
                    </button>
                    <button
                      type="button"
                      onClick={resetChangeForm}
                      disabled={changing}
                      className="py-2 px-3 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-800">Data is not encrypted</p>
              <p className="text-xs text-gray-500 mb-2">
                You chose local-only mode. Set up a passphrase to encrypt your data and enable cloud
                sync.
              </p>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Set up passphrase…
              </button>
            </>
          )}
        </div>
      </div>

      {/* Biometric — only relevant when vault is passphrase-protected */}
      {state.vaultProtected && (
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              state.bioEnrolled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <div className="flex-1">
            {state.bioEnrolled ? (
              <>
                <p className="text-sm font-medium text-gray-800">Biometric unlock enabled</p>
                <p className="text-xs text-gray-500 mb-2">
                  Fingerprint / face ID is registered on this device.
                </p>
                <button
                  type="button"
                  onClick={handleRemoveBiometric}
                  disabled={loading}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove biometric
                </button>
              </>
            ) : state.bioAvailable ? (
              <>
                <p className="text-sm font-medium text-gray-800">Biometric unlock not set up</p>
                <p className="text-xs text-gray-500 mb-2">
                  Your device supports fingerprint or face unlock.
                </p>
                {!showBioForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBioForm(true);
                      setBioError(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Enable biometric unlock
                  </button>
                ) : (
                  <div className="mt-2 space-y-3 border border-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-600">
                      Enter your passphrase to link biometric unlock on this device.
                    </p>
                    <PassphraseInput
                      id="bio-passphrase"
                      value={bioPassphrase}
                      onChange={setBioPassphrase}
                      label="Passphrase"
                      autoFocus
                    />
                    {bioError && <p className="text-xs text-red-600">{bioError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleEnableBiometric}
                        disabled={loading || !bioPassphrase}
                        className="flex-1 py-2 px-3 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Setting up…' : 'Enable biometric unlock'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBioForm(false);
                          setBioPassphrase('');
                          setBioError(null);
                        }}
                        disabled={loading}
                        className="py-2 px-3 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-800">Biometric unlock</p>
                <p className="text-xs text-gray-500">
                  No platform authenticator detected on this device.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      <ConfirmDialog
        open={showResetConfirm}
        title="Set up passphrase"
        message="This will reset your vault and restart the setup wizard. Any existing local data will be permanently deleted. Continue?"
        onConfirm={async () => {
          setShowResetConfirm(false);
          await reset();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
