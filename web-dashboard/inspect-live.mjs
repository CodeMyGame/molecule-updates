/**
 * Read-only: prints what the POS has pushed to restaurants/{uid}/live/today.
 * Shows whether the per-period metric blocks (week/month/year) are populated.
 *
 *   node inspect-live.mjs
 *   CLOUD_EMAIL='owner@example.com' CLOUD_PASSWORD='secret' node inspect-live.mjs
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

// Load local .env from root directory if present
function loadEnv() {
  const envPath = path.resolve('../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const parts = line.trim().split('=');
      if (parts.length >= 2 && !line.startsWith('#')) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    }
  }
}
loadEnv();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hidden) {
      const onData = (char) => {
        if (['\n', '\r', ''].includes(char.toString())) process.stdin.removeListener('data', onData);
        else process.stdout.write('\x1b[2K\x1b[200D' + question + '*'.repeat(rl.line.length));
      };
      process.stdin.on('data', onData);
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

function summarizePeriod(name, p) {
  if (!p) { console.log(`  ${name.padEnd(6)} : MISSING`); return; }
  const rev = (Number(p.revenue) || 0) / 100;
  console.log(
    `  ${name.padEnd(6)} : revenue ₹${rev.toFixed(2)}  orders ${p.orders ?? '-'}  ` +
    `aov ${p.averageOrderValue ?? '-'}  tax ${p.taxTotal ?? '-'}  ` +
    `discount ${p.discountTotal ?? '-'}  payments ${(p.payments || []).length}  ` +
    `types ${(p.ordersByType || []).length}  topItems ${(p.topItems || []).length}  ` +
    `cancelled ${p.cancelledOrders ? p.cancelledOrders.count : '-'}`
  );
}

async function main() {
  const email = process.env.CLOUD_EMAIL || (await ask('Owner email: '));
  const password = process.env.CLOUD_PASSWORD || (await ask('Password: ', { hidden: true }));

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;

  const snap = await getDoc(doc(db, `restaurants/${uid}/live/today`));
  if (!snap.exists()) { console.log('live/today does NOT exist — POS has not pushed.'); await deleteApp(app); process.exit(0); }

  const d = snap.data();
  console.log('\nlive/today for uid', uid);
  console.log('date:', d.date, ' updatedAt:', d.updatedAt?.toDate?.().toISOString?.() ?? d.updatedAt);
  console.log('has periods block:', !!d.periods);
  console.log('\nPer-period metrics:');
  summarizePeriod('today', d.periods?.today);
  summarizePeriod('week', d.periods?.week);
  summarizePeriod('month', d.periods?.month);
  summarizePeriod('year', d.periods?.year);
  console.log('\n(If week/month show revenue but 0 orders/empty arrays, the POS is still on old code.)');

  await deleteApp(app);
  process.exit(0);
}

main().catch((err) => { console.error('\nFailed:', err?.message || err); process.exit(1); });
