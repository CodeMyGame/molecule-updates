# Molecule — Owner Web Dashboard

A static, mobile-friendly dashboard that shows the live business summary the POS
pushes to Firestore. The owner signs in with the **same email/password** set in
the POS under **Settings → Cloud Dashboard**.

- Real-time (updates automatically via Firestore `onSnapshot`)
- Reads only `restaurants/{uid}/...` — isolation enforced by `../firestore.rules`
- Zero build step — plain HTML + Firebase Web SDK (CDN)

## Deploy to Firebase Hosting

One-time:

```bash
npm install -g firebase-tools
firebase login
```

From this `web-dashboard/` folder:

```bash
firebase deploy --only hosting
```

The CLI prints your live URL, e.g. `https://molecule-e2e95.web.app`.
Open it on any phone or computer and sign in.

## Notes

- Firebase auto-authorizes `*.web.app` / `*.firebaseapp.com` for sign-in. If you
  add a **custom domain**, also add it under Authentication → Settings →
  Authorized domains.
- The Firebase config in `public/index.html` is the public web config (safe to
  expose) — the security rules are the real lock.
- Tailwind is loaded via the Play CDN for simplicity. For a production build you
  can later switch to a compiled Tailwind bundle; not required for use.
