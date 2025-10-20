import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const rulesCount = await prisma.rule.count();
  res.status(200).json({ ok: true, rulesCount, time: new Date().toISOString() });
}
