import { Lock, KeyRound, LoaderCircle } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import {
  setupVault,
  unlockVaultSession,
  restoreVaultSession,
  recoverVault,
  type VaultConfig,
} from './crypto';
import { saveConfig, vaultConfig } from './api';

type VaultSession = { userId: string; key: CryptoKey };
const Context = createContext<{ session: VaultSession | null; lock: () => void }>({
  session: null,
  lock: () => {},
});
const STORAGE_KEY = 'varaq.vault.session.v1';
type UnlockedSession = VaultSession & { sessionKey: string };
export function VaultProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [session, setSession] = useState<VaultSession | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const generation = useRef(0);
  const clearStorage = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Storage may be disabled. */
    }
  };
  const lock = () => {
    generation.current++;
    clearStorage();
    setSession(null);
  };
  useEffect(() => {
    if (isLoading) return;
    const epoch = ++generation.current;
    setSession(null);
    if (!user) {
      clearStorage();
      return;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.userId !== user.id || typeof saved.sessionKey !== 'string') {
          clearStorage();
          return;
        }
        void restoreVaultSession(saved.sessionKey)
          .then((key) => {
            if (epoch === generation.current) setSession({ userId: user.id, key });
          })
          .catch(() => {
            if (epoch === generation.current) clearStorage();
          });
      }
    } catch {
      clearStorage();
    }
    return () => {
      generation.current++;
    };
  }, [user?.id, isLoading]);
  const unlock = (value: UnlockedSession) => {
    generation.current++;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ userId: value.userId, sessionKey: value.sessionKey }),
      );
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
    setSession({ userId: value.userId, key: value.key });
  };
  return (
    <Context.Provider value={{ session: session?.userId === user?.id ? session : null, lock }}>
      <UnlockContext.Provider value={unlock}>
        {storageWarning && (
          <p role="status">Tab storage is unavailable. Refreshing will lock your Vault.</p>
        )}
        {children}
      </UnlockContext.Provider>
    </Context.Provider>
  );
}
const UnlockContext = createContext<(session: UnlockedSession) => void>(() => {});
export const useVault = () => useContext(Context);
export function VaultGate() {
  const { pathname } = useLocation();
  const { session, lock } = useVault();
  const { user } = useAuth();
  return session ? (
    <>
      {pathname !== '/write' && (
        <div className="vault-lock-toolbar">
          <button className="varaq-action varaq-action--small" onClick={lock}>
            <Lock aria-hidden="true" />
            Lock Vault
          </button>
        </div>
      )}
      <Outlet key={session.userId} />
    </>
  ) : (
    <VaultUnlock key={user?.id} />
  );
}
function VaultUnlock() {
  const { user } = useAuth();
  const setSession = useContext(UnlockContext);
  const [config, setConfig] = useState<VaultConfig | null | undefined>();
  const [revision, setRevision] = useState(0);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recovery, setRecovery] = useState('');
  const [recover, setRecover] = useState(false);
  const [kit, setKit] = useState<Awaited<ReturnType<typeof setupVault>> | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const epoch = ++generation.current;
    setConfig(undefined);
    setKit(null);
    setPass('');
    setConfirm('');
    setRecovery('');
    setError('');
    void vaultConfig()
      .then((v) => {
        if (epoch === generation.current) {
          setConfig(v.config);
          setRevision(v.revision);
        }
      })
      .catch(() => {
        if (epoch === generation.current) setError('Could not load Vault. Refresh to retry.');
      });
    return () => {
      generation.current++;
    };
  }, [user?.id]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const epoch = generation.current;
    setBusy(true);
    setError('');
    try {
      if (!config && !kit) {
        if (pass !== confirm) throw new Error('Passphrases do not match.');
        const created = await setupVault(user.id, pass);
        if (epoch === generation.current) {
          setKit(created);
          setPass('');
          setConfirm('');
        }
        return;
      }
      let key: CryptoKey;
      let sessionKey: string;
      if (kit) {
        if (!ack) throw new Error('Save your recovery key first.');
        await saveConfig(kit.config, 0);
        key = kit.key;
        sessionKey = kit.sessionKey;
      } else if (recover) {
        if (pass !== confirm) throw new Error('Passphrases do not match.');
        const result = await recoverVault(user.id, config!, recovery, pass);
        await saveConfig(result.config, revision);
        key = result.key;
        sessionKey = result.sessionKey;
      } else {
        const result = await unlockVaultSession(user.id, config!, pass);
        key = result.key;
        sessionKey = result.sessionKey;
      }
      if (epoch === generation.current) {
        setPass('');
        setConfirm('');
        setRecovery('');
        setKit(null);
        setSession({ userId: user.id, key, sessionKey });
      }
    } catch {
      if (epoch === generation.current)
        setError(
          'Could not unlock or save the Vault. Check your credentials; refresh if another device changed the configuration.',
        );
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  return (
    <section className="page-content vault-unlock-page" aria-labelledby="vault-unlock-title">
      <div className="vault-unlock-card">
        <header className="vault-unlock-header">
          <span className="vault-unlock-icon">
            {recover || kit ? <KeyRound aria-hidden="true" /> : <Lock aria-hidden="true" />}
          </span>
          <p className="eyebrow">Your private notebook</p>
          <h1 id="vault-unlock-title">
            {kit
              ? 'Save your recovery key'
              : recover
                ? 'Recover your Vault'
                : config
                  ? 'Unlock your Vault'
                  : 'A place for your words.'}
          </h1>
          <p className="vault-unlock-intro">
            {kit
              ? 'Keep a way back to your words.'
              : recover
                ? 'Use your recovery key to choose a new Vault passphrase.'
                : config
                  ? 'Your words are waiting. Enter your Vault passphrase to open your private pages.'
                  : 'Create a separate Vault passphrase to keep your personal writing encrypted.'}
          </p>
        </header>
        {config === undefined && !error ? (
          <p className="vault-unlock-loading" role="status">
            <LoaderCircle aria-hidden="true" className="animate-spin" />
            Preparing your Vault…
          </p>
        ) : (
          <form onSubmit={submit} className="vault-unlock-form" aria-busy={busy}>
            {kit ? (
              <>
                <div className="vault-recovery-notice">
                  <KeyRound aria-hidden="true" />
                  <p>
                    Keep this key somewhere safe. Account password resets cannot recover your Vault.
                  </p>
                </div>
                <code className="vault-recovery-key">{kit.recovery}</code>
                <label className="vault-recovery-ack">
                  <input
                    type="checkbox"
                    checked={ack}
                    disabled={busy}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  <span>I have saved my recovery key</span>
                </label>
              </>
            ) : (
              <>
                {recover && (
                  <label className="vault-unlock-field" htmlFor="vault-recovery-key">
                    <span>Recovery key</span>
                    <input
                      id="vault-recovery-key"
                      autoComplete="off"
                      value={recovery}
                      disabled={busy}
                      placeholder="varaq1.…"
                      onChange={(e) => setRecovery(e.target.value)}
                      required
                    />
                  </label>
                )}
                <label className="vault-unlock-field" htmlFor="vault-passphrase">
                  <span>{recover ? 'New Vault passphrase' : 'Vault passphrase'}</span>
                  <input
                    id="vault-passphrase"
                    type="password"
                    autoComplete={config && !recover ? 'current-password' : 'new-password'}
                    value={pass}
                    disabled={busy}
                    placeholder={
                      config && !recover
                        ? 'Enter your Vault passphrase'
                        : 'Choose your Vault passphrase'
                    }
                    onChange={(e) => setPass(e.target.value)}
                    aria-describedby="vault-passphrase-help"
                    required
                  />
                </label>
                {(!config || recover) && (
                  <label className="vault-unlock-field" htmlFor="vault-passphrase-confirm">
                    <span>Confirm passphrase</span>
                    <input
                      id="vault-passphrase-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      disabled={busy}
                      placeholder="Enter it once more"
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </label>
                )}
                <p className="vault-unlock-hint" id="vault-passphrase-help">
                  Your Vault passphrase is separate from your account password.
                </p>
              </>
            )}
            <div className="vault-unlock-actions">
              <button
                className="varaq-action varaq-action--primary"
                disabled={busy || config === undefined || Boolean(kit && !ack)}
              >
                {busy ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Lock aria-hidden="true" />
                )}
                {busy
                  ? 'Working…'
                  : kit
                    ? 'Finish setup'
                    : recover
                      ? 'Recover Vault'
                      : config
                        ? 'Unlock'
                        : 'Create Vault'}
              </button>
              {config && !kit && (
                <button
                  type="button"
                  className="varaq-action"
                  disabled={busy}
                  onClick={() => {
                    setRecover(!recover);
                    setPass('');
                    setConfirm('');
                    setRecovery('');
                  }}
                >
                  <KeyRound aria-hidden="true" />
                  {recover ? 'Use passphrase' : 'Use recovery key'}
                </button>
              )}
            </div>
          </form>
        )}
        {error && (
          <p className="confirmation-error" role="alert">
            {error}
          </p>
        )}
        <footer className="vault-unlock-footer">
          <Lock aria-hidden="true" />
          <p>
            Your writing opens in this browser. It stays unlocked across refreshes until you lock it
            or sign out.
          </p>
        </footer>
      </div>
    </section>
  );
}
