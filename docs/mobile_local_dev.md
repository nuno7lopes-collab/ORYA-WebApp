# Mobile local dev (Expo Go) — quick steps

## 1) Start backend (local)
```bash
npm run dev:all
```
`dev:all` now binds to `0.0.0.0` and auto-detects your LAN IP for public URLs.  
If it picks the wrong IP, override:
```bash
DEV_ALL_PUBLIC_HOST=192.168.1.98 npm run dev:all
```

## 2) Start mobile (Expo Go)
```bash
npm run mobile:dev
```

## 3) Mobile env (LAN base URL)
Ensure `apps/mobile/.env` contains:
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.98:3000
```

## 4) Quick connectivity check (iPhone Safari)
```
http://192.168.1.98:3000
```
If this doesn’t open: check same Wi‑Fi, VPN/Private Relay off, macOS Firewall.
