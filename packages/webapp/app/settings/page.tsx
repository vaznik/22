'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { Nav } from '../components/Nav';
import { initTelegram } from '../lib/tg';

export default function SettingsPage() {
  const [language, setLanguage] = useState<'en'|'ru'>('en');
  const [notifications, setNotifications] = useState(true);
  const [refLink, setRefLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    initTelegram();
    apiGet('/me')
      .then((r) => {
        setLanguage(r.user.language);
        setNotifications(Boolean(r.user.notifications));

        const bot = process.env.NEXT_PUBLIC_BOT_USERNAME || 'YOUR_BOT';
        const short = process.env.NEXT_PUBLIC_WEBAPP_SHORTNAME || '';
        const tgId = String(r.user.tgUserId ?? r.user.id ?? '');
        const link = short ? `https://t.me/${bot}/${short}?startapp=ref_${tgId}` : `https://t.me/${bot}?start=ref_${tgId}`;
        setRefLink(link);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setError('');
    try {
      await apiPost('/settings', { language, notifications });
    } catch (e:any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div>
      <div className="container">
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 800 }}>Settings</div>
          <hr/>
          <div className="grid grid2">
            <div>
              <div className="small">Language</div>
              <select className="input" value={language} onChange={(e)=>setLanguage(e.target.value as any)}>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </div>
            <div>
              <div className="small">Notifications</div>
              <select className="input" value={notifications ? '1':'0'} onChange={(e)=>setNotifications(e.target.value==='1')}>
                <option value="1">On</option>
                <option value="0">Off</option>
              </select>
            </div>
          </div>
          <hr/>
          <div className="small">Referral link</div>
          <input className="input" value={refLink} readOnly />
          {error ? <div className="small">⚠️ {error}</div> : null}
          <div style={{ height: 10 }} />
          <button className="btn btnPrimary" onClick={save}>Save</button>
        </div>
        <div style={{ height: 70 }} />
      </div>
      <Nav />
    </div>
  );
}
