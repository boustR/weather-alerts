// api/health.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const rulesCount = await prisma.rule.count();
    res.status(200).json({ ok: true, rulesCount, time: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      code: e?.code ?? null,
    });
  }
}
