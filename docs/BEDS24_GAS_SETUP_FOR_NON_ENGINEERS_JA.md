# Beds24 API V2 実証GAS — 初回設定（非エンジニア向け）

**既存のSquare用GASでは実行しないでください。④葛西民泊の予約・在庫・Airbnb連携にも手を加えません。**

## 1. コピーするコードを取得
GitHub Actions の最新成功した Validate GuestOps AI から Artifacts > beds24-test-gas をダウンロードして解凍。
中にある `PasteIntoAppsScript.gs` をテキストエディタで開く（そのまま全選択してコピー）。

## 2. 実証専用のApps Scriptプロジェクトを作る
ブラウザで https://script.google.com/home/projects/create を開く。
左上のプロジェクト名を `GuestOpsAI_Beds24_V2_TEST` に変更。
`コード.gs` の既存サンプルをすべて消し、`PasteIntoAppsScript.gs` の内容を貼り付け、保存。
既存Squareや旧GASハブのプロジェクトは開かない・変更しない。

## 3. スクリプトプロパティを設定
左の歯車「プロジェクトの設定」→「スクリプト プロパティ」→「スクリプト プロパティを追加」。
- `GTOS_BEDS24_SETUP_ENABLED` = `true`
- `BEDS24_INVITE_CODE` = **新しく発行しチャットに投稿していない招待コード**
- `GTOS_BEDS24_READ_ENABLED` = `true`
新しい招待コードはBeds24で最小の bookings 読み取り権限のみ付ける。24時間以内に使用。
アカウントID `181334` はBeds24のアカウントIDであり、`GTOS_BEDS24_TEST_PROPERTY_ID` ではない。

## 4. 初回認証を1回だけ実行
編集画面上部の関数選択から `beds24SetupInviteCode` を選び「実行」を押す。
Googleアカウントの権限確認が出たら、実証用Apps Scriptへのアクセスを許可。
成功すると `BEDS24_INVITE_CODE` と `GTOS_BEDS24_SETUP_ENABLED` は自動的に削除される。
実行ログにトークンや招待コードを出さない。

## 5. 読み取り接続テスト
関数選択で `beds24ReadOnlyStatus` を実行し、`refreshTokenConfigured` が true であることを確認。
続けて `beds24ConnectionTest` を実行。`connected:true` なら Beds24 APIの予約一覧を読み取れたことを意味する。
これは API 連携全体（Webhookやメッセージ、価格更新）の完成証明ではない。

## 6. テスト物件を限定
Beds24の実証用施設の **property ID** を確認し、
`GTOS_BEDS24_TEST_PROPERTY_ID` に設定する。葛西本番の施設IDは登録しない。
メッセージ・料金更新は現状無効化してあり、このGASでは実行できない。

## 既知の境界
- Google CalendarからOTA在庫を同期しない。
- 初回実証は予約読取専用。実証用プロパティの実予約・IDがなければ特定予約の検証はできない。
- 本番へのデプロイではなく、専用GASエディタからの手動実行。
- 完全なAPI実証にはWebhook受信の認証/重複防止、独立したテスト物件でのメッセージ/料金書込・読戻しが必要。