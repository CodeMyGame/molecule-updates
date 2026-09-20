# Molecule — Master Admin Dashboard

Multi-tenant administration dashboard for Molecule POS.

### Features
- **All Restaurants Grid**: Real-time cards showing each restaurant's:
  - Daily Revenue (formatted in local currency)
  - Total Orders Today
  - Restaurant Name, Full Address, and Phone
  - License Expiry Date & Status (Active, Warning, Expired)
  - Real-time Day Open / Closed indicator
  - POS App Version and Heartbeat timestamp
- **Restaurant Error Logs**: Click "Error Logs" on any restaurant card to open the dedicated error inspector for that restaurant.
- **Search & Sort**: Filter by restaurant name, address, or license status. Sort by revenue, name, or expiry date.
- **Zero Build Step**: Standalone static HTML/JS + Tailwind CSS CDN + Firebase Web SDK.

### Deploy to Firebase Hosting

To deploy manually:
```bash
cd admin-dashboard
firebase deploy --only hosting
```
Or if using a multi-site Firebase Hosting target (e.g. `molecule-admin`):
```bash
firebase target:apply hosting admin molecule-admin
firebase deploy --only hosting:admin
```

### Automated CI/CD Pipeline (GitHub Actions)

A GitHub Actions workflow is provided in [`.github/workflows/deploy-admin-dashboard.yml`](../.github/workflows/deploy-admin-dashboard.yml):
- **Triggers**: Automatically on push to `main` when `admin-dashboard/**` changes, or manually via `workflow_dispatch`.
- **Secrets Used**: `FIREBASE_SERVICE_ACCOUNT_MOLECULE_E2E95` (already configured in repository secrets).
- **Entry point**: `admin-dashboard`.

