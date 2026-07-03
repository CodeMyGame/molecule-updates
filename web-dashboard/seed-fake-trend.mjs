/**
 * Seeds 7 days of FAKE daily revenue into Firestore so the "Last 7 days"
 * chart on the owner dashboard has something to render.
 *
 * Writes to: restaurants/{uid}/daily/{YYYY-MM-DD}
 * Amounts are in minor units (paise) — the dashboard divides by 100.
 *
 * Run (credentials are read interactively, not from shell history):
 *   node seed-fake-trend.mjs
 *
 * Or non-interactively:
 *   CLOUD_EMAIL='owner@example.com' CLOUD_PASSWORD='secret' node seed-fake-trend.mjs
 *
 * To remove the fake data later, re-run with --clear:
 *   node seed-fake-trend.mjs --clear
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const CLEAR = process.argv.includes('--clear');

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hidden) {
      // Mute echo while typing the password.
      const onData = (char) => {
        if (['\n', '\r', ''].includes(char.toString())) process.stdin.removeListener('data', onData);
        else process.stdout.write('\x1b[2K\x1b[200D' + question + '*'.repeat(rl.line.length));
      };
      process.stdin.on('data', onData);
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A believable-looking daily snapshot (only `revenue` drives the chart bars).
function fakeSnapshot(date, revenuePaise, orders) {
  const aov = orders ? Math.round(revenuePaise / orders) : 0;
  return {
    date,
    revenue: revenuePaise,
    orders,
    periods: { today: { revenue: revenuePaise, orders } },
    averageOrderValue: aov,
    covers: orders * 2,
    discountTotal: Math.round(revenuePaise * 0.04),
    discountedOrders: Math.round(orders * 0.15),
    taxTotal: Math.round(revenuePaise * 0.05),
    payments: [
      { mode: 'cash', total: Math.round(revenuePaise * 0.45), count: Math.round(orders * 0.45) },
      { mode: 'upi', total: Math.round(revenuePaise * 0.4), count: Math.round(orders * 0.4) },
      { mode: 'card', total: Math.round(revenuePaise * 0.15), count: Math.round(orders * 0.15) },
    ],
    ordersByType: [
      { type: 'dine_in', count: Math.round(orders * 0.6), revenue: Math.round(revenuePaise * 0.6) },
      { type: 'takeaway', count: Math.round(orders * 0.4), revenue: Math.round(revenuePaise * 0.4) },
    ],
    topItems: [
      { name: 'Paneer Tikka', quantity: 18, revenue: 252000 },
      { name: 'Butter Naan', quantity: 40, revenue: 160000 },
      { name: 'Masala Chai', quantity: 55, revenue: 110000 },
    ],
    cash: { opening: 200000, sales: Math.round(revenuePaise * 0.45), closing: 0, expected: 0, difference: 0 },
    cancelledOrders: { count: 1, value: 45000 },
    lowStock: [],
    amountsInMinorUnits: true,
    _fake: true, // marker so you know this row is seeded test data
    updatedAt: serverTimestamp(),
  };
}

async function main() {
  const email = process.env.CLOUD_EMAIL || (await ask('Owner email: '));
  const password = process.env.CLOUD_PASSWORD || (await ask('Password: ', { hidden: true }));

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('Signing in…');
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;
  console.log('Signed in. Restaurant uid:', uid);

  // Last 7 days, oldest → newest. Day index 0 = 6 days ago, 6 = today.
  const REVENUE = [612300, 488900, 905400, 734200, 1021800, 559600, 846100]; // paise
  const ORDERS = [22, 18, 31, 27, 36, 21, 29];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = localDateStr(d);
    const ref = doc(db, `restaurants/${uid}/daily/${date}`);

    if (CLEAR) {
      await deleteDoc(ref);
      console.log('  deleted', date);
    } else {
      const idx = 6 - i;
      await setDoc(ref, fakeSnapshot(date, REVENUE[idx], ORDERS[idx]), { merge: true });
      console.log('  wrote  ', date, '₹' + (REVENUE[idx] / 100).toFixed(2));
    }
  }

  console.log(CLEAR ? '\nCleared 7 fake daily docs.' : '\nDone — refresh the dashboard to see the chart.');
  await deleteApp(app);
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFailed:', err?.message || err);
  process.exit(1);
});
