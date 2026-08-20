# Downloads do AgroRural Admin

## Windows (pronto)

O instalador completo (app + emissor NF-e) está no Vercel Blob:

https://tixybegl1h3yln4s.public.blob.vercel-storage.com/emissor/AgroRural-Setup.exe

Arquivo gerado localmente: `installer/output/AgroRural-Setup-1.1.1.exe`

O portal `/admin` usa `getEmissorSetupDownloadUrl()` (env ou esse fallback).

Opcional na Vercel (Production):

```
EMISSOR_SETUP_URL=<url acima>
NEXT_PUBLIC_EMISSOR_SETUP_URL=<url acima>
NEXT_PUBLIC_ADMIN_EXE_URL=<url acima>
```

## Android (pronto)

APK no Vercel Blob:

https://tixybegl1h3yln4s.public.blob.vercel-storage.com/admin/AgroRural-Admin.apk

Gerar de novo (requer Android Studio / SDK):

```powershell
npm run mobile:apk
npm run mobile:upload-apk
```

O portal usa `getAdminApkDownloadUrl()` (env ou fallback Blob).

Opcional na Vercel:

```
NEXT_PUBLIC_ADMIN_APK_URL=<url do APK>
```
