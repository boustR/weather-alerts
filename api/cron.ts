import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/db';
import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function getCurrentTemp(lat: number, lon: number): Promise<number | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  // °C
  return data?.current_weather?.temperature ?? null;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // 1) Helpful guard for misconfigured env
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
      return res.status(500).json({ ok: false, error: 'Missing Twilio env vars' });
    }

    const rules = await prisma.rule.findMany({
      where: { active: true },
      include: { user: true },
    });

    let processed = 0, fired = 0;
    const details: Array<{
      ruleId: number;
      lat: number;
      lon: number;
      op: 'gt' | 'lt';
      threshold_c: number;
      temp: number | null;
      fire: boolean;
      alertId?: number;
    }> = [];

    for (const rule of rules) {
      processed++;

      const temp = await getCurrentTemp(rule.lat, rule.lon);

      // Collect per-rule debug info (before we possibly continue)
      const info: (typeof details)[number] = {
        ruleId: rule.id,
        lat: rule.lat,
        lon: rule.lon,
        op: rule.op,
        threshold_c: rule.threshold_c,
        temp,
        fire: temp != null &&
            ((rule.op === 'gt' && temp > rule.threshold_c) ||
                (rule.op === 'lt' && temp < rule.threshold_c)),
      };

      if (!(temp != null &&
          ((rule.op === 'gt' && temp > rule.threshold_c) ||
              (rule.op === 'lt' && temp < rule.threshold_c)))) {
        details.push(info);
        continue;
      }

      // Avoid duplicate open alerts
      const openAlert = await prisma.alert.findFirst({
        where: { ruleId: rule.id, acknowledged_at: null },
      });
      if (openAlert) {
        details.push(info); // still record the state
        continue;
      }

      // Create alert
      const alert = await prisma.alert.create({
        data: { ruleId: rule.id, value_c: temp! },
      });
      fired++;
      info.alertId = alert.id; // helpful in response

      // Send SMS
      const body = `ALERT rule ${rule.id}: ${temp!.toFixed(1)}°C. Reply "ACK ${alert.id}" to acknowledge.`;
      await twilioClient.messages.create({
        to: rule.user.phone,
        from: process.env.TWILIO_FROM_NUMBER!,
        body,
      });

      // Track last check
      await prisma.rule.update({
        where: { id: rule.id },
        data: { lastChecked: new Date() },
      });

      details.push(info);
    }

    res.json({ ok: true, processed, fired, details });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
