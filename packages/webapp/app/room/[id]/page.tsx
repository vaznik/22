'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { Nav } from '../../components/Nav';
import { useParams } from 'next/navigation';

function randomSeed() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [room, setRoom] = useState<any>(null);
  const [error, setError] = useState('');
  const [clientSeed, setClientSeed] = useState(randomSeed());
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    const d = localStorage.getItem('deviceId') || crypto.randomUUID();
    localStorage.setItem('deviceId', d);
    setDeviceId(d);
  }, []);

  const load = async () => {
    setError('');
    const r = await apiGet(`/rooms/${id}`);
    setRoom(r.room);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message ?? String(e)));
    const t = setInterval(() => load().catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [id]);

  const join = async () => {
    setError('');
    try {
      await apiPost(`/rooms/${id}/join`, { clientSeed, deviceId });
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const refund = async () => {
    setError('');
    try {
      await apiPost(`/rooms/${id}/refund`, {});
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  if (!room) return <div className="container"><div className="card">Loading...</div><Nav/></div>;

  return (
    <div>
      <div className="container">
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {room.game} • {room.currency} • stake {room.stakeAmount}
          </div>
          <div className="small">
            {room.kind} • {room.status} • {room.playersCount}/{room.maxPlayers} players
          </div>

          <hr />

          <div className="small">Provably fair commit:</div>
          <div className="small">serverSeedHash: {room.provablyFair.serverSeedHash}</div>
          <div className="small">nonce: {room.provablyFair.nonce}</div>

          <hr />

          <div className="grid grid2">
            <div>
              <div className="small">Client seed</div>
              <input className="input" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
            </div>
            <div>
              <div className="small">Actions</div>
              <div className="row">
                <button className="btn btnPrimary" onClick={join}>Join</button>
                <button className="btn" onClick={refund}>Refund</button>
              </div>
              <div className="small">Refund works for cancelled/empty timers.</div>
            </div>
          </div>

          {error ? <div className="small">⚠️ {error}</div> : null}

          <hr />

          <div style={{ fontWeight: 700 }}>Players</div>
          <div className="grid">
            {room.players.map((p: any) => (
              <div key={p.userId} className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  {p.avatarUrl ? <img src={p.avatarUrl} width={28} height={28} style={{ borderRadius: 999 }} /> : <span className="badge">👤</span>}
                  <div>
                    <div>{p.displayName}</div>
                    <div className="small">{new Date(p.joinedAt).toLocaleString()}</div>
                  </div>
                </div>
                <span className="badge">joined</span>
              </div>
            ))}
          </div>

          {room.settled ? (
            <>
              <hr />
              <div style={{ fontWeight: 800 }}>Result</div>
              <pre className="card" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(room.settled, null, 2)}</pre>
            </>
          ) : null}
        </div>

        <div style={{ height: 70 }} />
      </div>
      <Nav />
    </div>
  );
}
