import { Lock, KeyRound } from 'lucide-react';
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
    <section className="page-section">
      <h1>
        {kit
          ? 'Save your recovery key'
          : config
            ? 'Unlock your Vault'
            : 'Create your encrypted Vault'}
      </h1>
      <p>
        Your Vault passphrase is separate from your account password. Writing is decrypted in this
        tab until you lock it or sign out. Refreshing keeps it unlocked.
      </p>
      {config === undefined && !error ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={submit}>
          {kit ? (
            <>
              <p>
                Keep this key somewhere safe. Account password resets cannot recover your Vault.
              </p>
              <code style={{ overflowWrap: 'anywhere', display: 'block' }}>{kit.recovery}</code>
              <label>
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I
                have saved my recovery key
              </label>
            </>
          ) : (
            <>
              {recover && (
                <label>
                  Recovery key
                  <input
                    className="w-full"
                    autoComplete="off"
                    value={recovery}
                    onChange={(e) => setRecovery(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                {recover ? 'New Vault passphrase' : 'Vault passphrase'}
                <input
                  className="w-full"
                  type="password"
                  autoComplete={config && !recover ? 'current-password' : 'new-password'}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                />
              </label>
              {(!config || recover) && (
                <label>
                  Confirm passphrase
                  <input
                    className="w-full"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </label>
              )}
            </>
          )}
          <div className="varaq-actions">
            <button
              className="varaq-action varaq-action--primary"
              disabled={busy || config === undefined || Boolean(kit && !ack)}
            >
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
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
