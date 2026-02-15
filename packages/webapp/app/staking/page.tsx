'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { Nav } from '../components/Nav';

export default function StakingPage() {
  const [stakes, setStakes] = useState<any[]>([]);
  const [amountTon, setAmountTon] = useState('1');
  const [lockSeconds, setLockSeconds] = useState(86400);
  const [error, setError] = useState('');

  const load = async () => {
    const r = await apiGet('/staking');
    setStakes(r.stakes);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message ?? String(e)));
  }, []);

  const lock = async () => {
    setError('');
    try {
      await apiPost('/staking/lock', { amountTon, lockSeconds });
      await load();
    } catch (e:any) {
      setError(e.message ?? String(e));
    }
  };

  const unlock = async (stakeId: string) => {
    setError('');
    try {
      await apiPost('/staking/unlock', { stakeId });
      await load();
    } catch (e:any) {
      setError(e.message ?? String(e));
    }
  };

  return (
    <div>
      <div className="container">
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 800 }}>TON Staking</div>
          <div className="small">Lock/unlock + reward accrual (ledger-only).</div>
          <hr/>
          <div className="grid grid2">
            <div>
              <div className="small">Amount (TON)</div>
              <input className="input" value={amountTon} onChange={(e)=>setAmountTon(e.target.value)} />
            </div>
            <div>
              <div className="small">Lock seconds</div>
              <input className="input" type="number" value={lockSeconds} onChange={(e)=>setLockSeconds(Number(e.target.value))} />
            </div>
          </div>
          <div style={{ height: 10 }} />
          <button className="btn btnPrimary" onClick={lock}>Lock</button>
          {error ? <div className="small">⚠️ {error}</div> : null}

          <hr/>
          <div style={{ fontWeight: 700 }}>Your stakes</div>
          <div className="grid">
            {stakes.map((s) => (
              <div key={s.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div>amountNano: {s.amountNano}</div>
                    <div className="small">unlockAt: {new Date(s.unlockAt).toLocaleString()}</div>
                    <div className="small">status: {s.status}</div>
                  </div>
                  {s.status === 'LOCKED' ? (
                    <button className="btn" onClick={() => unlock(s.id)}>Unlock</button>
                  ) : (
                    <span className="badge">unlocked</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 70 }} />
      </div>
      <Nav />
    </div>
  );
}
