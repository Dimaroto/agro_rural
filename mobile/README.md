# AgroRural Admin — Android (Capacitor)

O app carrega a UI do admin no domínio com `client=mobile` (cookie de app).

## Setup

```bash
cd mobile
npm install
npx cap add android
npx cap sync android
npx cap open android
```

No Android Studio: Build → Generate Signed Bundle / APK → liberar `AgroRural-Admin.apk` e publicar em `public/downloads/` ou `NEXT_PUBLIC_ADMIN_APK_URL`.

## NF-e no mobile

Emissão no celular depende de `NEXT_PUBLIC_EMISSOR_URL` (Laravel hospedado). Sem isso, a aba Fiscal orienta a usar o app Windows (sidecar local).
