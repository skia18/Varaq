import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { setupVault, unlockVault, recoverVault, type VaultConfig } from './crypto';
import { saveConfig, vaultConfig } from './api';

type VaultSession = { userId: string; key: CryptoKey };
const Context = createContext<{ session: VaultSession | null; lock: () => void }>({
  session: null,
  lock: () => {},
});
export function VaultProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<VaultSession | null>(null);
  const lock = () => setSession(null);
  useEffect(() => {
    setSession(null);
  }, [user?.id]);
  // Account identity is checked during render too, before effects run.
  return (
    <Context.Provider value={{ session: session?.userId === user?.id ? session : null, lock }}>
      <UnlockContext.Provider value={setSession}>{children}</UnlockContext.Provider>
    </Context.Provider>
  );
}
const UnlockContext = createContext<(session: VaultSession) => void>(() => {});
export const useVault = () => useContext(Context);
export function VaultGate() {
  const { session, lock } = useVault();
  const { user } = useAuth();
  return session ? (
    <>
      <button className="literary-button" onClick={lock}>
        Lock Vault
      </button>
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
      if (kit) {
        if (!ack) throw new Error('Save your recovery key first.');
        await saveConfig(kit.config, 0);
        key = kit.key;
      } else if (recover) {
        if (pass !== confirm) throw new Error('Passphrases do not match.');
        const result = await recoverVault(user.id, config!, recovery, pass);
        await saveConfig(result.config, revision);
        key = result.key;
      } else key = await unlockVault(user.id, config!, pass);
      if (epoch === generation.current) {
        setPass('');
        setConfirm('');
        setRecovery('');
        setKit(null);
        setSession({ userId: user.id, key });
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
        tab until you lock it, sign out, or refresh.
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
                  minLength={!config || recover ? 12 : undefined}
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
          <button
            className="literary-button"
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
              onClick={() => {
                setRecover(!recover);
                setPass('');
                setConfirm('');
                setRecovery('');
              }}
            >
              {recover ? 'Use passphrase' : 'Use recovery key'}
            </button>
          )}
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
