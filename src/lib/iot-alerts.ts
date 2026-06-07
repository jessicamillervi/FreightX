/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, toSnakeCase } from './db';

export interface AlertConfig {
  maxTemperature: number; // in 100x scale, e.g. 800 for 8.0°C
  minTemperature: number; // in 100x scale, e.g. -2000 for -20.0°C
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  maxTemperature: 800,   // 8.0°C
  minTemperature: -2200, // -22.0°C
};

/**
 * Checks telemetry readings against threshold limits and triggers notifications/audit logs
 */
export async function checkThresholdsAndAlert(
  shipmentId: number,
  temperature: number, // raw value scaled by 100, e.g., -1850 for -18.5°C
  humidity: number,    // raw value scaled by 100, e.g., 5500 for 55.0%
  timestamp: number
): Promise<{ breached: boolean; message?: string }> {
  const tempCelsius = temperature / 100;
  const humidityPct = humidity / 100;

  // 1. Fetch shipment detail to get buyer/supplier details
  const { data: shipment, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .single();

  if (error || !shipment) {
    console.error(`[IoT Alerts] Shipment #${shipmentId} not found for alerting:`, error);
    return { breached: false };
  }

  let breached = false;
  let breachMessage = '';

  // Check temperature thresholds
  if (temperature > DEFAULT_ALERT_CONFIG.maxTemperature) {
    breached = true;
    breachMessage = `⚠️ COLD-CHAIN BREACH WARNING: Temperature has risen to ${tempCelsius}°C, exceeding the safe limit of ${DEFAULT_ALERT_CONFIG.maxTemperature / 100}°C for Shipment #${shipmentId}.`;
  } else if (temperature < DEFAULT_ALERT_CONFIG.minTemperature) {
    breached = true;
    breachMessage = `⚠️ COLD-CHAIN BREACH WARNING: Temperature has fallen to ${tempCelsius}°C, below the safe limit of ${DEFAULT_ALERT_CONFIG.minTemperature / 100}°C for Shipment #${shipmentId}.`;
  }

  if (breached) {
    console.warn(`[IoT Alerts] ${breachMessage}`);

    // Log the breach to audit logs in the DB
    await supabase.from('audit_logs').insert(
      toSnakeCase({
        userAddress: 'SYSTEM_ORACLE',
        action: 'IoT Threshold Breach Alerted',
        details: {
          shipmentId,
          temperature: tempCelsius,
          humidity: humidityPct,
          timestamp,
          warning: breachMessage,
          buyer: shipment.buyer,
          supplier: shipment.supplier,
        },
      }) as any
    );

    // Increment temperature violations counter in shipments table
    const currentViolations = Number(shipment.temperature_violations || 0);
    await supabase
      .from('shipments')
      .update(
        toSnakeCase({
          temperatureViolations: currentViolations + 1,
          temperature: tempCelsius,
          humidity: humidityPct,
        }) as any
      )
      .eq('id', shipmentId);

    // Simulate sending email/webhook alerts
    await sendMockEmailAlert(shipment.buyer, shipment.supplier, breachMessage);
    await sendMockWebhookAlert(breachMessage, {
      shipmentId,
      temperature: tempCelsius,
      humidity: humidityPct,
      timestamp,
    });
  }

  return { breached, message: breachMessage };
}

/**
 * Simulate email notification to buyer/supplier
 */
async function sendMockEmailAlert(buyer: string, supplier: string, message: string) {
  console.log(`[IoT Alerts] [EMAIL SIMULATOR] Dispatching notification to:`);
  console.log(`  - Buyer (${buyer})`);
  console.log(`  - Supplier (${supplier})`);
  console.log(`  - Message Body: "${message}"`);
}

/**
 * Simulate webhook alert to external service
 */
async function sendMockWebhookAlert(message: string, payload: object) {
  console.log(`[IoT Alerts] [WEBHOOK SIMULATOR] Dispatching POST request to subscriber endpoint...`);
  console.log(`  - Payload:`, JSON.stringify({ event: 'telemetry_breach', message, data: payload }));
}
