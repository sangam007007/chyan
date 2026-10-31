# Chayan: Android app (Play Store)

Ye app **Trusted Web Activity (TWA)** hai: Android app ke andar aapki website full-screen khulti hai (bina address bar ke).
App ka apna koi code nahi hai, isliye website me jo badlega wo app me apne aap aa jaata hai. Naya Play Store update sirf tab
chahiye jab naam, icon ya URL badle.

## 1. Apne phone par test karna (abhi)
`dist/chayan-debug.apk` phone me bhejein aur install karein ("Unknown sources" allow karna padega).
Ye `http://10.84.106.39:5173/dashboard` kholta hai, to **computer par frontend + backend chalte hone chahiye aur phone usi Wi-Fi par**.
`http` site Chrome ke "verified" mode me nahi aati, isliye abhi upar address bar dikhega. Asli full-screen tab aayega jab
site HTTPS par deploy hogi aur `assetlinks.json` lag jaayega (neeche).

Naye address ke saath debug APK banane ke liye: `./scripts/build-debug.sh https://aapki-site.com`

## 2. Play Store par daalne se pehle ye cheezein chahiye (aapki taraf se)
1. **Site + backend deploy** (HTTPS, apna domain). Bina iske app khaali khulegi.
2. **Package name** (`com.chayan.app`) pakka karein. Pehle upload ke baad kabhi nahi badal sakta. Badalna ho to `gradle.properties` me `appId`.
3. **Google Play developer account** (ek baar ki fees) aur uska verification.
4. **Privacy Policy** ka web link (zaroori) aur Play Console me "Data safety" form.
5. **Keystore**: `./scripts/create-keystore.sh` (sirf ek baar, apne terminal me). File aur password ko surakshit backup rakhein.

## 3. Release build (AAB) banana
```bash
export TWA_URL=https://aapki-site.com
export CHAYAN_KEYSTORE=$HOME/chayan-keys/chayan-upload.jks
export CHAYAN_KEYSTORE_PASSWORD='...'
export VERSION_CODE=1 VERSION_NAME=1.0.0      # har naye upload par VERSION_CODE +1
./scripts/build-release.sh
```
Ye `app/build/outputs/bundle/release/app-release.aab` banata hai (Play Console me yahi upload hota hai), ek signed APK, aur
`../frontend/public/.well-known/assetlinks.json` likhta hai.

**assetlinks.json (full-screen ke liye zaroori):** wo file `https://aapki-site.com/.well-known/assetlinks.json` par khulni chahiye.
Play Console ke "App integrity" me **App signing key certificate SHA-256** milta hai. Use `PLAY_SIGNING_SHA256` me daal kar
`build-release.sh` dobara chalayein aur site deploy karein. Isi se address bar chhupti hai.

## 4. Store listing
`store-listing/` me hai: icon (512), feature graphic (1024x500), 6 phone screenshots, aur `listing.md` (English + Hindi text).

## Build ke liye is machine par kya set kiya gaya
Android SDK `~/Android/Sdk` (platform 36, build-tools 36), JDK 17 `~/jdk/jdk-17*`, Gradle wrapper 8.14.6, AGP 8.13.2,
`androidbrowserhelper` 2.7.4. minSdk 24 (Android 7+), targetSdk 36. Scripts khud JDK/SDK dhoondh lete hain (`scripts/env.sh`).
