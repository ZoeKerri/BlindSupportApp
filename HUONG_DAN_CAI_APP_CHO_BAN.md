# Huong dan cai APK BlindSupport cho ban be

Tai lieu nay danh cho ban cua ban muon cai app ma khong can chay code.

## 1) Build APK release tu code

Yeu cau tren may build:
- Da cai Node.js >= 18
- Da cai Android SDK + platform-tools
- Da cai JDK (de chay Gradle)

Chay lenh trong thu muc du an:

```bat
cd D:\Project\ho_tro_khiem_thi\BlindSupport\android
gradlew assembleRelease
```

Neu build thanh cong, file APK nam o:

```text
android\app\build\outputs\apk\release\app-release.apk
```

## 2) Gui file APK cho nguoi khac

Ban co the gui file qua:
- Zalo
- Google Drive
- Telegram
- USB

## 3) Cai APK tren dien thoai Android

Tren dien thoai cua nguoi nhan:
1. Mo file APK da nhan.
2. Neu bi chan, bat quyen "Install unknown apps" cho app dang mo file.
3. Bam Install.
4. Mo BlindSupport va cap quyen camera/microphone neu duoc hoi.

## 4) Update phien ban moi

Neu ban build lai ban moi va gui tiep:
- Neu cung khoa ky (cung keystore): cai de len duoc.
- Neu khac khoa ky: can go app cu roi cai lai.

## 5) Cai truc tiep bang ADB (tuy chon)

Neu nguoi nhan co may tinh va bat USB debugging:

```bat
adb install -r app-release.apk
```

## 6) Luu y quan trong

- Ban release khong can Metro development server.
- Ban debug (npm run android) moi can Metro.
- De test nhu nguoi dung that, luon gui ban release APK.
