import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/db';
import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function getCurrentTemp(lat: number, lon: number): Promise<number | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.current_weather?.temperature ?? null;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const rules = await prisma.rule.findMany({
      where: { active: true },
      include: { user: true },
    });

    let processed = 0, fired = 0;

    for (const rule of rules) {
      processed++;
      const temp = await getCurrentTemp(rule.lat, rule.lon);
      if (temp == null) continue;

      const fire =
        (rule.op === 'gt' && temp > rule.threshold_c) ||
        (rule.op === 'lt' && temp < rule.threshold_c);

      if (!fire) continue;

      // If an unacknowledged alert already exists, skip duplicate
      const openAlert = await prisma.alert.findFirst({
        where: { ruleId: rule.id, acknowledged_at: null },
      });
      if (openAlert) continue;

      const alert = await prisma.alert.create({
        data: { ruleId: rule.id, value_c: temp },
      });
      fired++;

      const body = `ALERT rule ${rule.id}: ${temp.toFixed(1)}°C. Reply "ACK ${alert.id}" to acknowledge.`;
      await twilioClient.messages.create({
        to: rule.user.phone,
        from: process.env.TWILIO_FROM_NUMBER!,
        body,
      });

      await prisma.rule.update({
        where: { id: rule.id },
        data: { lastChecked: new Date() },
      });
    }

    res.json({ ok: true, processed, fired });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
