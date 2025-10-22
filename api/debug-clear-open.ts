import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const now = new Date();
  const updated = await prisma.alert.updateMany({
    where: { acknowledged_at: null },
    data: { acknowledged_at: now, ack_from_phone: 'debug-clear-open' },
  });
  res.json({ ok: true, closed: updated.count, at: now.toISOString() });
}
