import https from 'https';
import { logger } from '../utils/logger';
import * as settingsRepo from '../db/repositories/settings.repo';

/**
 * WhatsApp service using ChatMitra API.
 * Sends bill images to customers via WhatsApp.
 */

export type WhatsAppStatus = 'disconnected' | 'connected';

export function getStatus(): WhatsAppStatus {
  const apiKey = settingsRepo.get('chatmitra_api_key');
  const enabled = settingsRepo.get('whatsapp_enabled');
  return (apiKey && enabled === 'true') ? 'connected' : 'disconnected';
}

export function getLastQr(): string {
  return '';
}

export async function initialize(): Promise<void> {}

export async function destroy(): Promise<void> {}

function getApiKey(): string {
  const key = settingsRepo.get('chatmitra_api_key');
  if (!key) throw new Error('ChatMitra API key not configured. Go to Settings > Billing to add it.');
  return key;
}

/**
 * Send a WhatsApp message with an image via ChatMitra API.
 * Endpoint: POST https://app.chatmitra.com/apis/sendImage.php
 * Body: JSON { apikey, mobile, image (base64 data URI or URL), caption }
 */
export async function sendWhatsAppImage(phone: string, imageBase64: string, caption?: string): Promise<void> {
  const apiKey = getApiKey();

  let formattedPhone = phone.replace(/\D/g, '');
  // ChatMitra expects number with country code (91 for India)
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone;
  }

  const body = JSON.stringify({
    apikey: apiKey,
    mobile: formattedPhone,
    image: imageBase64,
    caption: caption || '',
  });

  return new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'app.chatmitra.com',
        port: 443,
        path: '/apis/sendImage.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          logger.info(`ChatMitra response (${res.statusCode}): ${data}`);
          try {
            const result = JSON.parse(data);
            if (result.status === true || result.status === 'true' || result.success === true) {
              logger.info(`WhatsApp bill sent to ${formattedPhone} via ChatMitra`);
              resolve();
            } else {
              const errMsg = result.message || result.msg || `HTTP ${res.statusCode}`;
              logger.error('ChatMitra API error:', errMsg);
              reject(new Error(errMsg));
            }
          } catch {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`ChatMitra API error: HTTP ${res.statusCode} - ${data}`));
            }
          }
        });
      }
    );

    req.on('error', (err) => {
      logger.error('ChatMitra request failed:', err);
      reject(new Error(`Failed to connect to ChatMitra API: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Send a plain WhatsApp text message via ChatMitra API.
 * Endpoint: POST https://app.chatmitra.com/apis/sendMsg.php
 */
export async function sendWhatsAppText(phone: string, message: string): Promise<void> {
  const apiKey = getApiKey();

  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone;
  }

  const body = JSON.stringify({
    apikey: apiKey,
    mobile: formattedPhone,
    msg: message,
  });

  return new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'app.chatmitra.com',
        port: 443,
        path: '/apis/sendMsg.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          logger.info(`ChatMitra text response (${res.statusCode}): ${data}`);
          try {
            const result = JSON.parse(data);
            if (result.status === true || result.status === 'true' || result.success === true) {
              resolve();
            } else {
              reject(new Error(result.message || result.msg || `HTTP ${res.statusCode}`));
            }
          } catch {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`ChatMitra API error: HTTP ${res.statusCode} - ${data}`));
            }
          }
        });
      }
    );

    req.on('error', (err) => {
      logger.error('ChatMitra text request failed:', err);
      reject(new Error(`Failed to connect to ChatMitra API: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

// Backward compat alias
export async function sendSms(phone: string, message: string): Promise<void> {
  return sendWhatsAppText(phone, message);
}

export async function sendImage(
  phone: string,
  _imageBuffer: Buffer,
  _filename: string,
  caption?: string
): Promise<void> {
  await sendWhatsAppText(phone, caption || '');
}
