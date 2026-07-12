import admin from 'firebase-admin';
import webpush from 'web-push';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!serviceAccount.project_id || !vapidPublicKey || !vapidPrivateKey) {
  console.error("Missing configuration. Ensure FIREBASE_SERVICE_ACCOUNT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY are set.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

webpush.setVapidDetails(
  'mailto:support@moleculepos.com',
  vapidPublicKey,
  vapidPrivateKey
);

async function run() {
  // Get yesterday's date in Asia/Kolkata
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const yesterdayStr = `${y}-${m}-${day}`;
  console.log(`Sending notifications for date: ${yesterdayStr}`);

  const restaurants = await db.collection('restaurants').get();
  console.log(`Found ${restaurants.size} restaurants.`);

  for (const restDoc of restaurants.docs) {
    const uid = restDoc.id;
    const restData = restDoc.data() || {};
    const name = restData.restaurantName || "your restaurant";

    const dailyDoc = await db.doc(`restaurants/${uid}/daily/${yesterdayStr}`).get();
    if (!dailyDoc.exists) {
      console.log(`No daily data found for restaurant ${uid} on ${yesterdayStr}`);
      continue;
    }

    const data = dailyDoc.data();
    const revenue = (Number(data.revenue) || 0) / 100;
    const orders = Number(data.orders) || 0;

    const payload = JSON.stringify({
      title: "Daily Sales Summary",
      body: `Yesterday, ${name} earned ₹${revenue.toLocaleString()} across ${orders} order(s).`
    });

    const tokensSnap = await db.collection(`restaurants/${uid}/notificationTokens`).get();
    console.log(`Restaurant ${uid} (${name}) has ${tokensSnap.size} token(s).`);

    const promises = tokensSnap.docs.map(async (tokenDoc) => {
      const subStr = tokenDoc.data().subscription;
      if (!subStr) return;
      
      const sub = JSON.parse(subStr);
      try {
        await webpush.sendNotification(sub, payload);
        console.log(`Sent notification to token ${tokenDoc.id}`);
      } catch (err) {
        console.error(`Failed to send to token ${tokenDoc.id}:`, err.statusCode);
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Deleting expired token ${tokenDoc.id}`);
          await tokenDoc.ref.delete();
        }
      }
    });

    await Promise.all(promises);
  }
}

run().then(() => {
  console.log("Done.");
  process.exit(0);
}).catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
