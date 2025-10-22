import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const alerts = await prisma.alert.findMany({
    orderBy: { id: 'desc' },
    take: 50,
    include: { rule: true },
  });
  res.json(alerts);
}
