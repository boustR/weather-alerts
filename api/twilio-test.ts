import { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { to, body } = (req.method === 'POST' ? req.body : req.query) as { to?: string; body?: string };

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
      return res.status(500).json({ ok: false, error: 'Missing Twilio env vars' });
    }
    if (!to) return res.status(400).json({ ok: false, error: 'Provide ?to=+61XXXXXXXXX (E.164)' });

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({
      to,
      from: process.env.TWILIO_FROM_NUMBER!,
      body: body || 'Twilio test from Vercel',
    });

    res.json({ ok: true, sid: msg.sid, status: msg.status });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
