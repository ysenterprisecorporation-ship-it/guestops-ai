# GuestOps AI 販売・納品自動化システム

Squareの購入を記録し、購入商品に対応する既存Google DriveフォルダURLを購入者へメールで案内する。A購入メールには既存のP3/P10差額購入リンクも記載する。

既存Google Sites、Square商品・価格・販売リンク・決済リダイレクト、DriveフォルダID・URL・共有権限は変更しない。Driveの「自動通知」は既存フォルダURLのメール案内であり、共有招待・権限付与ではない。送信元はGASを実行する管理者アカウント、返信先はADMIN_EMAIL。

**ローカル実装・テスト済み。本番接続は未実施。ホスティング方式と実値は未確定。** 前版の「GAS直接受信・署名なし」は本版では廃止する。今回必須になったSquare署名検証にはHTTPヘッダーを取得できる受信口が必要なため、設置先はユーザーへ確認中。Cloud Runの追加は承認前に行わない。Node.js 24の受信モジュールはCloud Run/既存サーバーの両方で利用できる。

## 構成と実装範囲

```text
Square
  → HTTPS受信口：raw bodyとSquare署名を検証
  → 署名付き通知をGASへ転送
  → GAS：転送署名＋Square署名を再検証
  → LogsへQUEUEを永続保存して署名付き応答
  → 受信口：保存応答を検証後にSquareへ200
  → GASの1分トリガー：決済・注文APIをGET再照合
  → Orders記録 → 商品別メール → Logs記録
```

Squareの署名は `HMAC-SHA256(購読URLの完全一致文字列 + raw body, 購読の署名鍵)` のbase64。JSONを再シリアライズしてから検証しない。Node受信口ではcrypto.timingSafeEqualを使用する。GASはUtilitiesで再検証し、比較ループを途中終了しないが、JavaScript実行時間の厳密なconstant-timeは保証しない。主たる外部署名検証はNodeで行う。

受信口からGASへの転送はRELAY_SHARED_SECRETでHMACを付ける。5分以内の時刻・ランダムnonceを検証する。GASの応答にもnonceとHMACを付け、QUEUE保存後だけ成功応答を返す。GASのContentServiceのリダイレクトは受信口が追従する。GAS例外、HTMLエラーページ、応答署名不一致、通信失敗は受信口が503を返す。GAS転送タイムアウトは6.5秒、HTTP受信の応答期限は8.5秒。実環境の遅延とSquareの10秒以内応答を必ず確認する。

Node側はasync/awaitとPromiseを使用する。GASの入口とGoogle同期API呼出しはPromiseを返さない。

## 設定だけで導入するための準備

Node.js 24と、選定済みのHTTPSホストが必要。GAS、Spreadsheet、Webhook購読は自動化専用の新規資産を使う。既存の販売資産は流用して読み取り、改修しない。

```sh
npm ci
cp .env.example .env
# 管理者が確認済みの実値を.envへ入力
npm run env:check
npm run check
npm run lint
npm test
npm run build
npm run export:properties
```

.envがなくてもCI/テスト/ビルドは成功する。env:checkは実値を投入した管理者用の検証で、空欄の未確認値では停止する。書式検査だけなので、IDの存在・認証権限・URLアクセス可否は実環境で確認する。既存のシェル環境変数は.envの値より優先される。

`.env`と`.local/`のファイルは秘密値を含む。Git対象外で、エクスポートファイルは0600で作成する。既存ファイルへ上書きする場合も権限を確認する。GitHub SecretsやソースにSquareトークンを追加する必要はない。全実値は管理者の環境とGAS Script Propertiesへ入力する。Nodeホスト側はホストのシークレット注入機能を利用し、ソースやコマンド履歴へ秘密を埋め込まない。

### 設定一覧

価格はA=2,980円、P3=29,800円、P10=99,800円、P3差額=26,820円、P10差額=96,820円に固定。価格変更用の環境変数は設けない。

|設定|内容・保存先|
|---|---|
|A_URL / P3_URL / P10_URL|既存の通常商品購入URL。環境変数→GAS Properties|
|UPGRADE_P3_URL / UPGRADE_P10_URL|既存の差額購入URL。環境変数→GAS Properties|
|SITE_URL|既存Google Sites URL。環境変数→GAS Properties|
|DRIVE_A / DRIVE_P3 / DRIVE_P10|既存フォルダID。環境変数→GAS Properties|
|DRIVE_A_URL / DRIVE_P3_URL / DRIVE_P10_URL|既存納品URLそのもの。IDから推測で生成しない|
|VARIATION_A / VARIATION_P3 / VARIATION_P10|既存Square catalog variation ID|
|VARIATION_UPGRADE_P3 / VARIATION_UPGRADE_P10|既存差額商品のvariation ID|
|SQUARE_ACCESS_TOKEN|秘密。GAS Propertiesのみで使用。PAYMENTS_READ/ORDERS_READを確認|
|SQUARE_API_VERSION|Developer Consoleで確認したAPI版の日付。推測の既定値なし|
|SQUARE_ENVIRONMENT|sandbox または production|
|SQUARE_MERCHANT_ID / SQUARE_LOCATION_ID|対象商店・店舗ID|
|SPREADSHEET_ID|自動化専用Spreadsheet ID|
|ADMIN_EMAIL|管理者1名。購入者への返信先にも使用|
|SQUARE_WEBHOOK_SIGNATURE_KEY|新規購読の署名鍵。GAS Propertiesと受信口のシークレット注入に同じ値を設定|
|SQUARE_WEBHOOK_NOTIFICATION_URL|新規HTTPS受信口の完全なURL。Square購読/GAS/受信口で文字単位一致|
|RELAY_SHARED_SECRET|暗号学的乱数32バイト以上をbase64urlで43文字以上にする。GASと受信口で同じ値|
|AUTOMATION_ENABLED|GAS処理の有効化。初期false|
|BUYER_EMAIL_ENABLED|購入者案内メールの有効化。初期false、受入時にtrue|
|GAS_SCRIPT_ID|新規GASのID。ローカルclasp設定生成のみで使用|
|GAS_WEB_APP_URL|新規GASの匿名公開/exec URL。受信口で使用。販売URLとは別|
|RECEIVER_ENABLED|受信口の有効化。初期false|

全URL/ID/鍵の実値は未確認。環境ごとにGAS・Spreadsheet・受信口・購読・鍵を分離する。古いWEBHOOK_URL_SECRETやACKNOWLEDGE_UNSIGNED_WEBHOOKは使わない。.env.exampleから本版の設定を作り直す。

## 管理コンソールと本番導入手順

### 1. Google Spreadsheet / Apps Script

1. 自動化専用Spreadsheetと新規スタンドアロンGASを用意する。既存販売資料を上書きしない。既存Driveフォルダを移動・整理しない。
2. Spreadsheet ID、GASの「プロジェクトの設定」にあるスクリプトIDを.envへ転記。シートのタイムゾーンはAsia/Tokyo、共有は管理者だけにする。
3. npm run build後、dist/Code.jsとdist/Entrypoints.jsをGASの.gsファイルとして転記し、dist/appsscript.jsonをマニフェストへ転記する。ソースへの実値入力は不要。
4. 「デプロイ→新しいデプロイ→ウェブアプリ」で実行者=自分、アクセス=全員を設定し、/exec URLをGAS_WEB_APP_URLへ転記。組織ポリシーで匿名受信不可なら停止する。/devは使わない。Google Sitesへ埋め込まない。
5. 受信口URLとSquare購読の署名鍵を取得した後、残りの.envを入力してnpm run env:check、npm run export:propertiesを実行する。
6. GASの「プロジェクトの設定→スクリプト プロパティ」でBOOTSTRAP_CONFIG_JSONを追加し、.local/script-properties.jsonのJSON全体を値として貼り付ける。コードへ秘密JSONを貼らない。
7. configureAutomationを実行する。検証して全設定を保存し、AUTOMATION_ENABLED=falseへ固定、BOOTSTRAP_CONFIG_JSONを削除する。BUYER_EMAIL_ENABLEDも初期設定のfalseを維持する。
8. setupAutomationを実行し、Google権限を認可する。Orders/LogsとprocessQueueの1分トリガーが作成される。既存の非互換ヘッダは上書きしない。
9. 左側「トリガー」で失敗通知を設定し、「実行数」で失敗履歴を確認する。トリガーは実行者に紐づくため同じ管理者アカウントでセットアップ・運用する。

claspを使う場合は別途Google公式CLIを用意して本人アカウントで認証し、npm run configure:claspで新規GAS用の.clasp.jsonを生成する。新規IDを確認してからpushする。手動転記でも全機能を導入できる。

### 2. 署名検証用HTTPS受信口

ホスティング方式は確認待ち。Cloud Run追加は未承認のため、現時点ではクラウド資産を作成しない。既存のNode.js 24サーバーを使う場合は次の汎用手順で導入できる。

1. `npm run build`で生成されたreceiver/dist/server.mjsを、選定したNode.js 24ホストに配置する。実行時のnpm依存は不要。インターネット公開側はHTTPS必須で、localhostのHTTPをSquareへ登録しない。
2. 初回はRECEIVER_ENABLED=falseで起動する。停止中は署名鍵とURLが未確定でも起動し、GET /healthで生存確認できるが、通知には503を返す。
3. ホストが発行するURLまたは既存ホストの新規パスをSQUARE_WEBHOOK_NOTIFICATION_URLとして確定する。販売リンクや既存Webhookの通知URLを流用・変更しない。
4. Squareの新規購読で署名鍵を取得し、GAS設定と同じ値を受信口へ設定する。GAS_WEB_APP_URL、RELAY_SHARED_SECRET、通知URLも設定する。`npm run export:receiver`で.local/receiver-environment.jsonを生成し、ホスト管理コンソールへ転記できる。出力は停止状態。
5. Nodeサービスの起動コマンドは`node receiver/dist/server.mjs`、PORTはホスト提供値または8080。ローカル検証では`npm run receiver:start`で.envを読み込む。サービスの常駐・TLS・再起動は選定ホストの機能で管理する。
6. GASの設定・デプロイが完了してからRECEIVER_ENABLED=trueへ変更し、サービスを再起動する。GAS側もAUTOMATION_ENABLED=trueにする。BUYER_EMAIL_ENABLEDはSandboxメール検証時にtrue。
7. 受信口はSQUARE_WEBHOOK_NOTIFICATION_URLのパスとクエリが一致するPOSTだけを処理する。末尾スラッシュ・URLエンコード・クエリの違いは署名不一致につながる。署名値はSquare仕様のヘッダーから取得する。

Cloud Runを選択する場合のサービス作成・権限・秘密値注入・デプロイの具体手順は、追加承認後に確定する。今回のソースはホスティング方式を選ばず動作する。

### 3. Square Developer Console

1. 対象アプリのSandbox/Productionを確認する。API版、merchant/location ID、PAYMENTS_READ/ORDERS_READを確認する。APIトークンとWebhook署名鍵は別物。
2. 既存5商品のvariation IDを読み取り、設定へ転記する。差額商品が存在しない・variation IDを持たない場合は未確認として停止し、通常商品を改修して解決しない。
3. Webhooks/Subscriptionsで新規購読のみ追加し、イベントをpayment.created/payment.updatedにする。通知先は署名検証受信口の完全なURL。既存購読・販売リンク・リダイレクトは変更しない。
4. 購読のSignature Keyを取得して、受信口とGASへ同じ値を設定する。GASのURLをSquareへ直接登録しない。
5. Sandboxで5商品の実決済と購入者メールを確認する。サンプル通知は決済IDがAPI上で実在しない場合があるため、それだけでAPI照合成功とは判断しない。
6. 通知履歴で10秒以内の2xx、保存失敗時の503とSquare再送を確認する。特にGASを一時停止・ロック競合・権限不足にして、保存されないのに成功扱いされないことを確認する。
7. Sandbox合格後に別の本番設定で導入する。実運用の次の注文を照合し、案内メールの実受信を確認してから完成扱いにする。

### 4. Gmail / 購入者メール

MailAppのGoogle権限はsetupAutomationの認可時に許可する。送信元アカウントの名前・返信先を確認し、Sandboxでは管理者が管理するテストメールを購入者として使用する。本番顧客へテストメールを送らない。

GAS Script PropertiesでBUYER_EMAIL_ENABLED=trueにすると、API確認済みの購入者メールへ対応Drive URLを送信する。Aのみ既存差額購入リンクを付ける。Driveの共有範囲を広げず、既存共有設定で購入者が閲覧できることを管理者が事前確認する。URLを通知しただけで閲覧権限が付与されるわけではない。

送信前にOrders状態をDELIVERY_SENDINGとしてflushし、成功後DELIVEREDにする。送信済み注文は再送しない。送信直後の障害・MailApp例外で結果が不明な場合はDELIVERY_REVIEW、またはDELIVERY_SENDINGのまま残し、管理者へ通知する。自動再送して重複メールを発生させない。クォータ不足のように未送信が確実な場合は初回＋再試行3回。

## 記録・再試行・運用

Ordersは「日時 / Square注文ID / メール / 商品 / 金額 / URL / 状態」。日時はSquare注文作成時刻。商品管理キーはA / P3 / P10 / UPGRADE_P3 / UPGRADE_P10で、Squareの商品名は変更しない。URLは対応する既存Drive納品URL。

状態はRECORDED、DELIVERY_SENDING、DELIVERED、DELIVERY_REVIEW。DELIVEREDは案内メール送信完了であり、購入者による閲覧完了ではない。メールを無効にした時期のDONEジョブを自動遡及送信する機能はない。

Logsは「日時 / 処理 / 結果 / 内容」、結果はINFO / WARN / ERROR。QUEUEのJSONには決済ID・試行回数・状態・通知状態だけを保持する。メールや通知全文、秘密情報はLogsに保存しない。QUEUE行は更新され、処理結果は別途追記する。

注文は1商品・数量1・JPY・店舗一致・注文ID一致・決済/注文COMPLETED・決済総額/注文総額/商品単価が固定価格に一致した場合だけ処理する。複数商品、税/割引/送料で価格が一致しない注文、メールなしはエラー。A購入歴による差額購入資格の判定は追加しない。Webhook重複は決済ID、Ordersと送信状態は注文IDで防ぐ。

通信・429・5xx・未完了注文は初回＋再試行3回、1/2/4分間隔。価格違い・商品不明など確定エラーは即時管理者通知。1回最大10件・約3分。Logs全件走査のため、大量運用前に実行時間・クォータを測る。

管理者通知が失敗した場合は1時間後に再試行する。通知成功直後の状態保存失敗では管理者通知が重複する可能性がある。Sheets自体が停止するとログ/再試行状態も保存不能なので、GAS実行履歴・トリガー失敗通知を併用する。

設定変更時は新規購読と受信口を停止し、stopAutomationを実行する。設定の取込みは停止状態に戻る。新コードへの変更は新しいGASデプロイ版を公開し、受信口の成果物も再配置する。設定値だけの変更はGAS再ビルド不要。署名鍵や通知URLの変更はSquare/受信口/GASを一致させる。

DELIVERY_REVIEWはGmailの送信済みを管理者が確認してから、既送信ならOrdersをDELIVEREDへ修正し、未送信が確定した場合だけRECORDEDへ修正して対応QUEUEをPENDING, attempts=0, nextAt=0, notified=falseに戻す。稼働中にOrders/Logsを編集・並べ替えない。

停止期間はSquare決済とOrdersを照合し、必要通知を再送して補完する。記録・送信状態は削除しない。ロールバックは新規購読/受信口停止→stopAutomation→新規GASデプロイのアーカイブ。既存販売導線は継続する。

## フェーズ別作業

### フェーズ1：署名・通知プロトコル

1. 目的：本物のSquare通知だけを受け入れ、GASへの保存成功を保証する応答を確認。
2. 変更ファイル：src/Runtime.ts、Settings.ts、build.mjs、package.json、tsconfig.json、.env.example。
3. 新規ファイル：receiver/Signature.ts、Handler.ts、Settings.ts、Server.ts、src/RelayProtocol.ts、RelayService.ts、receiver/dist/server.mjs、署名/転送テスト。
4. 実装コード：NodeのverifySquare→handleWebhook、GASのverifyEnvelope→doPost→makeReceipt。受信口設置先は確認待ちで、クラウド資産は未作成。
5. テスト方法：Square公式署名ベクトル、本文/URL/鍵改変、転送期限切れ、HTML200/不正応答の503を検証。
6. ロールバック：新規受信口・購読を停止してGASを停止。旧無署名構成へ無断で戻さない。

### フェーズ2：商品別Driveメール

1. 目的：購入者への納品URL案内を自動化し、人間のメール作成時間を減らす。
2. 変更ファイル：Runtime.ts、SheetService.ts、Settings.ts、.env.example、既存テスト。
3. 新規ファイル：EmailService.ts、tests/email.test.ts。
4. 実装コード：purchaseEmail→deliverPurchase、Ordersの永続送信状態。Driveへの書込みなし。
5. テスト方法：5商品のURLとA差額リンク、送信済み/不明状態での再送防止、クォータ不足、署名受信からメールまでのモック統合。
6. ロールバック：BUYER_EMAIL_ENABLED=false。既存送信状態を保持し、記録のみの運用へ戻す。

### フェーズ3：設定・本番受入

1. 目的：管理者が実値を入力し、ソース編集なしで導入する。
2. 変更ファイル：scripts/environment.mjs、README.md、ACCEPTANCE.md、CI、再ビルドしたdist。
3. 新規ファイル：.prettierignore。外部GAS/Spreadsheet/HTTPS受信口/購読は導入時に新規作成。
4. 実装コード：env:check、export:properties、export:receiver、configureAutomation、setupAutomation。ホスティング選択後にその管理画面の具体手順を確定する。
5. テスト方法：npm run check / lint / test / build、実Webhookと実メールの受入項目をACCEPTANCE.mdへ記録。
6. ロールバック：新規資産のみ停止。既存URL・価格・権限は変更しない。

## GitHub管理・検証

CIは型検査・ESLint・モックテスト・ビルド・生成物の一致を確認する。GAS/Square/ホストへの自動デプロイはしない。PRのChecksを確認してからマージする。.env.example以外の.env、.local、.clasp.json、node_modulesはGit対象外。

根拠（2026-10-10確認）：

- [Square署名検証：URL＋raw body＋購読鍵](https://developer.squareup.com/docs/webhooks/step3validate)
- [Square Webhooks：10秒応答・重複・再送](https://developer.squareup.com/docs/webhooks/overview)
- [Google GAS Web Apps：入口とイベント構造](https://developers.google.com/apps-script/guides/web)
- [Google Content Service：リダイレクト](https://developers.google.com/apps-script/guides/content)
- [Google Utilities：HMAC署名](https://developers.google.com/apps-script/reference/utilities/utilities)

Stripe、独自管理画面、CRM、LINE等は追加しない。実環境のURL/ID/権限/メール到達は未確認であり、モック成功を本番稼働実績とは扱わない。
