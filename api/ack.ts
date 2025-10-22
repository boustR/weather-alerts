import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { prisma } from '../lib/db';

const AckIn = z.object({ alertId: z.number().int().positive() });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = AckIn.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { alertId } = parsed.data;
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) return res.status(404).json({ ok: false, error: 'Alert not found' });
  if (alert.acknowledged_at) return res.json({ ok: true, message: 'Already acknowledged' });

  await prisma.alert.update({
    where: { id: alertId },
    data: { acknowledged_at: new Date(), ack_from_phone: 'manual' },
  });

  res.json({ ok: true });
}
