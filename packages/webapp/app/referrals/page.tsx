'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { Nav } from '../components/Nav';

export default function ReferralsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/referrals').then(setData).catch((e) => setError(e.message ?? String(e)));
  }, []);

  return (
    <div>
      <div className="container">
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 800 }}>Referrals</div>
          <div className="small">Anti-multiaccount limits enabled.</div>
          <hr/>
          {error ? <div className="small">⚠️ {error}</div> : null}
          {data ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>Total invited</div>
                <span className="badge">{data.count}</span>
              </div>
              <hr/>
              <div style={{ fontWeight: 700 }}>Last invites</div>
              <div className="grid">
                {data.last.map((x:any) => (
                  <div key={x.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div>{x.invitee.username || x.invitee.firstName || 'user'}</div>
                    <div className="small">{new Date(x.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="small">Loading...</div>}
        </div>
        <div style={{ height: 70 }} />
      </div>
      <Nav />
    </div>
  );
}
