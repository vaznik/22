'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { Nav } from '../components/Nav';

export default function HistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/history').then((r) => setItems(r.items)).catch((e) => setError(e.message ?? String(e)));
  }, []);

  return (
    <div>
      <div className="container">
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 800 }}>History</div>
          <div className="small">Finished games + proof of fairness (commit-reveal).</div>
          <hr/>
          {error ? <div className="small">⚠️ {error}</div> : null}
          <div className="grid">
            {items.map((it) => (
              <div key={it.id} className="card">
                <div style={{ fontWeight: 700 }}>{it.game} • {it.currency} • stake {it.stakeAmount}</div>
                <div className="small">settled: {new Date(it.settledAt).toLocaleString()}</div>
                <div className="small">serverSeedHash: {it.provablyFair.serverSeedHash}</div>
                <div className="small">nonce: {it.provablyFair.nonce}</div>
                <details>
                  <summary className="small">Reveal + outcome</summary>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(it, null, 2)}</pre>
                </details>
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
