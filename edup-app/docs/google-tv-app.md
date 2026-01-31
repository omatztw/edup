# Google TV アプリ化計画

## 概要

既存のNext.jsアプリ（Vercelデプロイ済み）をTWA (Trusted Web Activity) でラップし、Google TV向けアプリとしてGoogle Playに公開する。

## 方式: TWA (Trusted Web Activity)

- Webアプリ自体はVercel上にそのまま残す
- Android側はChromeエンジンでVercelのURLを全画面表示するだけ
- コードの二重管理が不要

## 前提条件

- Google Play デベロッパーアカウント ($25 / 初回のみ)
- Digital Asset Links による所有権検証（Vercelドメインに `.well-known/assetlinks.json` を配置）
- アプリのPWA化（manifest.json + Service Worker）

## 実装ステップ

### Step 1: PWA対応 (Web側)

1. **`public/manifest.json`** を追加
   - `name`, `short_name`, `start_url`, `display: standalone`
   - アイコン各サイズ (192x192, 512x512)
   - `theme_color`, `background_color`

2. **Service Worker** を追加
   - オフライン時の基本的なキャッシュ戦略
   - `public/sw.js` として配置

3. **`layout.tsx`** に manifest と theme-color の meta を追加

4. **`next.config.ts`** に必要なヘッダー設定

### Step 2: Digital Asset Links

Vercelに `public/.well-known/assetlinks.json` を配置し、TWAアプリの署名証明書との紐付けを行う。

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.edup.tv",
    "sha256_cert_fingerprints": ["<署名証明書のSHA-256>"]
  }
}]
```

### Step 3: TWA Android プロジェクト生成

[Bubblewrap CLI](https://github.com/nicedoc/nicedoc.io/blob/master/nicedocs/nicedoc.io.md) を使ってAndroidプロジェクトを自動生成する。

```bash
npx @nicedoc/nicedoc.io init --manifest https://<your-domain>/manifest.json
```

または手動で Android Studio プロジェクトを作成。

**AndroidManifest.xml に必要な設定:**

```xml
<!-- TV対応 -->
<uses-feature android:name="android.software.leanback" android:required="true" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />

<!-- TV向けバナー (320x180px) -->
<application android:banner="@drawable/tv_banner">
```

### Step 4: TV向けUI調整 (Web側)

- D-pad/リモコンでのフォーカス移動に対応（`tabIndex`, キーボードイベント）
- 横長レイアウトの最適化
- テキスト入力の最小化（QRコードログイン等を検討）

### Step 5: ビルドと公開

1. Android Studio または Bubblewrap で APK/AAB をビルド
2. Google Play Console で「TV」カテゴリとしてアプリを登録
3. TV向けスクリーンショット、バナー画像を用意
4. 審査に提出

## speechSynthesis について

- TWA は Chrome エンジンを使うため、speechSynthesis API 自体は利用可能
- ただし Google TV 端末に日本語音声エンジンがインストールされているかは端末依存
- 現在の「speechSynthesis → mp3フォールバック」構成はそのまま維持する

## アーキテクチャ

```
Google TV
  └─ TWAアプリ (Android / Chrome)
       └─ Vercel上のNext.jsアプリを表示
            └─ Supabase (Auth / DB)
```

## 今回のスコープ（このPRで実装するもの）

- [x] PWA対応（manifest.json, Service Worker, layout.tsx更新）
- [ ] Digital Asset Links（デプロイ先ドメイン・署名証明書確定後）
- [ ] Android TWAプロジェクト作成（別リポジトリ or `/android` ディレクトリ）
- [ ] TV向けUI調整（別タスク）

## 参考リンク

- [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity)
- [Bubblewrap](https://github.com/nicedoc/nicedoc.io/blob/master/nicedocs/nicedoc.io.md)
- [Android TV Requirements](https://developer.android.com/training/tv)
