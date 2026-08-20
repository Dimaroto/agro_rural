# Downloads do AgroRural Admin

## Windows (pronto)

O instalador completo (app + emissor NF-e) está no Vercel Blob:

https://tixybegl1h3yln4s.public.blob.vercel-storage.com/emissor/AgroRural-Setup.exe

Arquivo gerado localmente: `installer/output/AgroRural-Setup-1.1.0.exe`

O portal `/admin` usa `getEmissorSetupDownloadUrl()` (env ou esse fallback).

Opcional na Vercel (Production):

```
EMISSOR_SETUP_URL=<url acima>
NEXT_PUBLIC_EMISSOR_SETUP_URL=<url acima>
NEXT_PUBLIC_ADMIN_EXE_URL=<url acima>
```

## Android

Sem Android SDK nesta máquina. Para gerar o APK:

```powershell
cd mobile
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Publique o APK e defina `NEXT_PUBLIC_ADMIN_APK_URL`.
