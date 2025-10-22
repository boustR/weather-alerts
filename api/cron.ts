import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/db';
import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function getCurrentTemp(lat: number, lon: number): Promise<number | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.current_weather?.temperature ?? null; // °C
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
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
      openAlertId?: number;
      alertId?: number;
      twilioError?: string;
    }> = [];

    for (const rule of rules) {
      processed++;

      const temp = await getCurrentTemp(rule.lat, rule.lon);
      const fire =
        temp != null &&
        ((rule.op === 'gt' && temp > rule.threshold_c) ||
         (rule.op === 'lt' && temp < rule.threshold_c));

      const info: (typeof details)[number] = {
        ruleId: rule.id,
        lat: rule.lat,
        lon: rule.lon,
        op: rule.op,
        threshold_c: rule.threshold_c,
        temp,
        fire,
      };

      if (!fire) {
        details.push(info);
        continue;
      }

      // Skip duplicates if there's already an open alert
      const openAlert = await prisma.alert.findFirst({
        where: { ruleId: rule.id, acknowledged_at: null },
      });
      if (openAlert) {
        info.openAlertId = openAlert.id;
        details.push(info);
        continue;
      }

      let alertId: number | undefined;
      try {
        const alert = await prisma.alert.create({
          data: { ruleId: rule.id, value_c: temp! },
        });
        alertId = alert.id;

        const body = `ALERT rule ${rule.id}: ${temp!.toFixed(1)}°C. Reply "ACK ${alert.id}" to acknowledge.`;
        await twilioClient.messages.create({
          to: rule.user.phone,
          from: process.env.TWILIO_FROM_NUMBER!,
          body,
        });

        fired++;
        info.alertId = alertId;

        await prisma.rule.update({
          where: { id: rule.id },
          data: { lastChecked: new Date() },
        });
      } catch (err: any) {
        // Roll back the alert so future runs can try again
        if (alertId) {
          await prisma.alert.delete({ where: { id: alertId } }).catch(() => {});
        }
        info.twilioError = err?.message || String(err);
      }

      details.push(info);
    }

    res.json({ ok: true, processed, fired, details });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
