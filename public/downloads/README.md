# Placeholders

Os instaladores reais são gerados por:

- `npm run desktop:dist` → `desktop/dist/AgroRural-Admin-Setup.exe`
- Android Studio (pasta `mobile`) → `AgroRural-Admin.apk`

Copie os artefatos para esta pasta ou configure:

```
NEXT_PUBLIC_ADMIN_EXE_URL=https://...
NEXT_PUBLIC_ADMIN_APK_URL=https://...
NEXT_PUBLIC_EMISSOR_URL=http://127.0.0.1:8787
```
