# AgroRural Admin — Android (Capacitor)

O app carrega a UI do admin em `https://agroruralzortea.com.br/admin/app-boot?client=mobile`.

## Pré-requisitos

- [Android Studio](https://developer.android.com/studio) (já detectado em `C:\Program Files\Android\Android Studio`)
- SDK em `%LOCALAPPDATA%\Android\Sdk`
- JDK do próprio Android Studio (`jbr`, Java 21)

## Build do APK (instalador)

```powershell
powershell -ExecutionPolicy Bypass -File mobile\build-android.ps1
```

Ou:

```powershell
cd mobile
npm run build:apk
```

Saídas:

- `public/downloads/AgroRural-Admin.apk`
- `installer/output/AgroRural-Admin-1.0.0.apk`

A keystore fica em `mobile/keystore/` (ignorada pelo git). Guarde o backup se for publicar na Play Store.

## Abrir no Android Studio

```powershell
cd mobile
npm install
npx cap sync android
npx cap open android
```

## Publicar o download

```powershell
npm run mobile:upload-apk
```

URL atual (fallback no código):  
https://tixybegl1h3yln4s.public.blob.vercel-storage.com/admin/AgroRural-Admin.apk

Opcional na Vercel: `NEXT_PUBLIC_ADMIN_APK_URL=<url>`.

## NF-e no mobile

Emissão no celular depende de `NEXT_PUBLIC_EMISSOR_URL` (Laravel hospedado). Sem isso, use o app Windows.
