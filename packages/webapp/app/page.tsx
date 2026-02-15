'use client';
import { useEffect, useMemo, useState } from 'react';
import { initTelegram, userFromInitDataUnsafe } from './lib/tg';
import { apiGet, apiPost } from './lib/api';
import { Nav } from './components/Nav';
import Link from 'next/link';

export default function LobbyPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [currency, setCurrency] = useState('XTR');
  const [game, setGame] = useState('ROULETTE');
  const [kind, setKind] = useState('SYSTEM');
  const [balances, setBalances] = useState<{ XTR: string; TON: string }>({ XTR: '0', TON: '0' });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    initTelegram();
    apiGet('/bootstrap').catch(() => {});
  }, []);

  const load = async () => {
    setError('');
    const qs = new URLSearchParams({ currency, game, kind }).toString();
    const r = await apiGet(`/rooms?${qs}`);
    setRooms(r.rooms);
    const b = await apiGet('/balance');
    setBalances(b.balances);
  };

  useEffect(() => {
    load().catch((e) => setError(String(e.message ?? e)));
  }, [currency, game, kind]);

  const user = useMemo(() => userFromInitDataUnsafe(), []);

  return (
    <div>
      <div className="container">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>🎰 Casino Rooms</div>
              <div className="small">User: {user?.username || user?.first_name || user?.id}</div>
            </div>
            <div className="grid">
              <div className="small">XTR: {balances.XTR}</div>
              <div className="small">TON: {balances.TON}</div>
              <Link className="btn" href="/deposit">+ Deposit</Link>
            </div>
          </div>

          <hr />

          <div className="grid grid2">
            <div>
              <div className="small">Currency</div>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="XTR">XTR (Stars)</option>
                <option value="TON">TON</option>
              </select>
            </div>
            <div>
              <div className="small">Game</div>
              <select className="input" value={game} onChange={(e) => setGame(e.target.value)}>
                <option value="ROULETTE">Roulette</option>
                <option value="COINFLIP">Coinflip</option>
                <option value="JACKPOT">Jackpot</option>
                <option value="CRASH">Crash</option>
              </select>
            </div>
            <div>
              <div className="small">Kind</div>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="SYSTEM">System rooms</option>
                <option value="USER">User rooms</option>
              </select>
            </div>
            <button className="btn btnPrimary" onClick={() => load()}>
              Refresh
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {error ? <div className="card">⚠️ {error}</div> : null}

        <div className="grid">
          {rooms.map((r) => (
            <Link key={r.id} href={`/room/${r.id}`} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {r.game} • {r.currency} • stake {r.stakeAmount}
                  </div>
                  <div className="small">
                    {r.kind} • {r.status} • players {r.playersCount}/{r.maxPlayers}
                  </div>
                </div>
                <span className="badge">Open</span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ height: 70 }} />
      </div>
      <Nav />
    </div>
  );
}
