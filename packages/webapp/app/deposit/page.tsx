'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { Nav } from '../components/Nav';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';

export default function DepositPage() {
  const [xtr, setXtr] = useState('100');
  const [ton, setTon] = useState('0.5');
  const [error, setError] = useState('');
  const [balances, setBalances] = useState<any>(null);
  const [pendingBoc, setPendingBoc] = useState<string>('');
  const [pendingTonAmount, setPendingTonAmount] = useState<string>('');

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const load = async () => {
    const b = await apiGet('/balance');
    setBalances(b.balances);
  };

  useEffect(() => {
    load().catch(()=>{});
  }, []);

  const starsHowTo = () => {
    // Stars deposit is via bot invoice. We show instructions.
    alert('Stars deposit: open bot chat and use /deposit <amount>. Or press Deposit in bot menu.');
  };

    const confirmPendingTon = async () => {
    setError('');
    try {
      if (!pendingBoc) throw new Error('no_pending_ton_tx');
      const to = process.env.NEXT_PUBLIC_TON_RECEIVER_ADDRESS!;
      await apiPost('/payments/ton/confirm', { boc: pendingBoc, amountTon: pendingTonAmount || ton, to });
      await load();
      setPendingBoc('');
      setPendingTonAmount('');
      alert('✅ TON deposit confirmed & credited.');
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('ton_not_found_yet')) {
        setError('TON tx not found on-chain yet. Wait ~5-30 seconds and press “Confirm deposit” (no double-charge: idempotent).');
        return;
      }
      setError(msg);
    }
  };

  const sendTon = async () => {
    setError('');
    try {
      const to = process.env.NEXT_PUBLIC_TON_RECEIVER_ADDRESS!;
      const amountNano = BigInt(Math.floor(Number(ton) * 1e9)).toString();

      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: to, amount: amountNano }],
      });

      const boc = (tx as any)?.boc as string | undefined;
      if (!boc) throw new Error('ton_boc_missing');

      setPendingBoc(boc);
      setPendingTonAmount(ton);

      await apiPost('/payments/ton/confirm', { boc, amountTon: ton, to });

      await load();
      setPendingBoc('');
      setPendingTonAmount('');
      alert('✅ TON deposit confirmed & credited.');
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('ton_not_found_yet')) {
        setError('TON tx sent, but not found on-chain yet. Wait ~5-30 seconds and press “Confirm deposit”.');
        return;
      }
      setError(msg);
    }
  };

  return (
    <div>
      <div className="container">
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 800 }}>Deposit</div>
          <div className="small">Stars (XTR) via bot invoice • TON via TonConnect</div>
          <hr/>
          {balances ? <div className="small">Balances: XTR {balances.XTR} • TON {balances.TON}</div> : null}
          <hr/>

          <div className="grid grid2">
            <div className="card">
              <div style={{ fontWeight: 700 }}>Stars (XTR)</div>
              <div className="small">Deposit through bot payments. Gift-mode: convert Gifts → Stars yourself.</div>
              <div style={{ height: 8 }} />
              <input className="input" value={xtr} onChange={(e)=>setXtr(e.target.value)} />
              <div style={{ height: 8 }} />
              <button className="btn btnPrimary" onClick={starsHowTo}>How to deposit</button>
            </div>

            <div className="card">
              <div style={{ fontWeight: 700 }}>TON</div>
              <div className="small">Connect wallet and send to receiver address.</div>
              <div style={{ height: 8 }} />
              <input className="input" value={ton} onChange={(e)=>setTon(e.target.value)} />
              <div style={{ height: 8 }} />
              <button className="btn" onClick={() => tonConnectUI.openModal()}>{wallet ? 'Wallet connected' : 'Connect wallet'}</button>
              <div style={{ height: 8 }} />
              <button className="btn btnPrimary" onClick={sendTon} disabled={!wallet}>Send TON</button>
              <div style={{ height: 8 }} />
              <button className="btn" onClick={confirmPendingTon} disabled={!pendingBoc}>Confirm deposit</button>
              {pendingBoc ? <div className="small">Pending TON tx ready for confirmation.</div> : null}
            </div>
          </div>

          {error ? <div className="small">⚠️ {error}</div> : null}
        </div>

        <div style={{ height: 70 }} />
      </div>
      <Nav />
    </div>
  );
}
