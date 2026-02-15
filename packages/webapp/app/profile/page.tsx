'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../lib/api';
import { initTelegram, userFromInitDataUnsafe } from '../lib/tg';
import { Nav } from '../components/Nav';

export default function ProfilePage() {
  const [balances, setBalances] = useState<{ XTR: string; TON: string }>({ XTR: '0', TON: '0' });
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState('');

  const user = useMemo(() => userFromInitDataUnsafe(), []);

  const load = async () => {
    setError('');
    const [b, m] = await Promise.all([apiGet('/balance'), apiGet('/me')]);
    setBalances(b.balances);
    setMe(m.user);
  };

  useEffect(() => {
    initTelegram();
    load().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const refLink = useMemo(() => {
    const bot = process.env.NEXT_PUBLIC_BOT_USERNAME || 'YOUR_BOT';
    const short = process.env.NEXT_PUBLIC_WEBAPP_SHORTNAME || '';
    const tgId = user?.id ? String(user.id) : 'me';

    // Best option: open Mini App directly with startapp=... so Telegram passes start_param in initData
    if (short) return `https://t.me/${bot}/${short}?startapp=ref_${tgId}`;

    // Fallback: bot /start (will NOT populate start_param automatically)
    return `https://t.me/${bot}?start=ref_${tgId}`;
  }, [user]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied ✅');
    } catch {
      alert(text);
    }
  };

  return (
    <div>
      <div className="container">
        <div className="topbar">
          <div className="topbarLeft">
            <div className="title">Профиль</div>
            <div className="topPill">
              <span className="dot" />
              <span className="mini">ID: {user?.username || user?.first_name || user?.id || 'guest'}</span>
            </div>
          </div>
          <div className="topbarRight">
            <div className="balancePill">
              <span className="mini">XTR</span>
              <span style={{ fontWeight: 900 }}>{balances.XTR}</span>
            </div>
            <div className="balancePill">
              <span className="mini">TON</span>
              <span style={{ fontWeight: 900 }}>{balances.TON}</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="card">
            <div className="cardInner">⚠️ {error}</div>
          </div>
        ) : null}

        <div className="grid">
          <div className="card">
            <div className="cardInner">
              <div className="h2">Аккаунт</div>
              <div className="sep" />
              <div className="mini">Language: {me?.language || 'en'}</div>
              <div className="mini">Notifications: {me?.notifications ? 'on' : 'off'}</div>
              <div style={{ height: 10 }} />
              <button className="btn" onClick={() => load()}>
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid2">
            <Link className="card" href="/deposit">
              <div className="cardInner">
                <div className="h2">Депозит</div>
                <div className="mini">Stars / TON</div>
              </div>
            </Link>

            <Link className="card" href="/staking">
              <div className="cardInner">
                <div className="h2">Стейкинг</div>
                <div className="mini">lock / unlock / claim</div>
              </div>
            </Link>
          </div>

          <div className="card">
            <div className="cardInner">
              <div className="h2">Рефералка</div>
              <div className="mini">Приглашай друзей и получай бонус</div>
              <div style={{ height: 10 }} />
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={refLink} readOnly />
                <button className="btn" onClick={() => copy(refLink)}>
                  Copy
                </button>
              </div>
              <div style={{ height: 10 }} />
              <div className="row">
                <Link className="btn btnPrimary" href="/referrals">
                  Статистика
                </Link>
                <Link className="btn" href="/settings">
                  Настройки
                </Link>
                <Link className="btn" href="/history">
                  История
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardInner">
              <div className="h2">Поддержка</div>
              <div className="mini">
                Если TON депозит “завис” — открой <b>Deposit</b> и нажми <b>Confirm deposit</b>.
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />
      </div>

      <Nav />
    </div>
  );
}
