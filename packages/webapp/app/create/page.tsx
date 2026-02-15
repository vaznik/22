'use client';
import { useState } from 'react';
import { apiPost } from '../lib/api';
import { Nav } from '../components/Nav';
import { useRouter } from 'next/navigation';

export default function CreateRoomPage() {
  const [currency, setCurrency] = useState('XTR');
  const [game, setGame] = useState('ROULETTE');
  const [stakeAmount, setStakeAmount] = useState('10');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [startMode, setStartMode] = useState<'TIMER' | 'FILL'>('FILL');
  const [startDelaySeconds, setStartDelaySeconds] = useState(30);
  const [error, setError] = useState('');
  const router = useRouter();

  const submit = async () => {
    setError('');
    try {
      const r = await apiPost('/rooms', {
        currency,
        game,
        stakeAmount,
        maxPlayers,
        startMode,
        startDelaySeconds: startMode === 'TIMER' ? startDelaySeconds : undefined,
      });
      router.push(`/room/${r.roomId}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div>
      <div className="container">
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 700 }}>Create room</div>
          <div className="small">User room: choose currency, stake, max players, start mode.</div>

          <hr />

          <div className="grid grid2">
            <div>
              <div className="small">Currency</div>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="XTR">XTR</option>
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
              <div className="small">Stake</div>
              <input className="input" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
            </div>

            <div>
              <div className="small">Max players</div>
              <input className="input" type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} />
            </div>

            <div>
              <div className="small">Start mode</div>
              <select className="input" value={startMode} onChange={(e) => setStartMode(e.target.value as any)}>
                <option value="FILL">On fill</option>
                <option value="TIMER">By timer</option>
              </select>
            </div>

            {startMode === 'TIMER' ? (
              <div>
                <div className="small">Delay seconds</div>
                <input className="input" type="number" value={startDelaySeconds} onChange={(e) => setStartDelaySeconds(Number(e.target.value))} />
              </div>
            ) : (
              <div />
            )}
          </div>

          <hr />
          {error ? <div className="small">⚠️ {error}</div> : null}
          <button className="btn btnPrimary" onClick={submit}>Create</button>
        </div>

        <div style={{ height: 70 }} />
      </div>
      <Nav />
    </div>
  );
}
