import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { prisma } from '../lib/db';

const RuleIn = z.object({
  phone: z.string().regex(/^\+?\d+$/),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  op: z.enum(['>', '<']),
  threshold_c: z.number(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const rules = await prisma.rule.findMany({ include: { user: true }, orderBy: { id: 'desc' } });
    return res.json(rules);
  }

  if (req.method === 'POST') {
    const parsed = RuleIn.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const { phone, lat, lon, op, threshold_c } = parsed.data;

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    const rule = await prisma.rule.create({
      data: { userId: user.id, lat, lon, op: op === '>' ? 'gt' : 'lt', threshold_c },
    });

    return res.status(201).json(rule);
  }

  res.status(405).end();
}
