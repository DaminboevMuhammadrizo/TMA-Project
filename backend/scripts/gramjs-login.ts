/**
 * One-time interactive GramJS (MTProto) login.
 *
 * MTProto login requires a phone number + the OTP code Telegram texts/sends
 * to that number (and possibly a 2FA password) — this is inherently an
 * interactive, human-in-the-loop step and is intentionally NOT automated.
 * Run this once, answer the prompts, then paste the printed StringSession
 * into your `.env` as TELEGRAM_SESSION. The backend itself never needs to
 * run this flow — it just connects with the resulting session string.
 *
 * Usage: npm run gramjs:login
 */
import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const input = require('input');

async function main(): Promise<void> {
  const apiId = Number(process.env.TELEGRAM_API_ID || (await input.text('TELEGRAM_API_ID (from my.telegram.org): ')));
  const apiHash =
    process.env.TELEGRAM_API_HASH || (await input.text('TELEGRAM_API_HASH (from my.telegram.org): '));

  if (!apiId || !apiHash) {
    console.error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required.');
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log('Starting GramJS login. You will be prompted for your phone number and the login code.\n');

  await client.start({
    phoneNumber: async () => input.text('Phone number (with country code, e.g. +998901234567): '),
    password: async () => input.password('2FA password (leave empty if not set): '),
    phoneCode: async () => input.text('Login code (sent via Telegram/SMS): '),
    onError: (err) => console.error('Login error:', err.message),
  });

  console.log('\nLogin successful.\n');
  console.log('Copy the line below into your .env as TELEGRAM_SESSION:\n');
  console.log(client.session.save());
  console.log('\nDone. You can now start the backend normally.');

  await client.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('GramJS login failed:', err);
  process.exit(1);
});
