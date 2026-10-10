# GuestOps AI 販売・納品自動化システム v1.0

実装済み・ローカル検証済み。設定値を投入してSandbox受入後に本番導入できるパッケージ。本番は未接続・未稼働。
既存Google Sites、Driveフォルダ、Square商品・価格・販売URLへ変更を行うコードは含まない。
購入商品別の既存Drive URL案内メールと、A購入時の既存差額リンク案内を追加した。Drive共有権限・商品内容は変更しない。

**初期REQUIRE_SIGNATUREモードでは署名ヘッダー取得不可により受信・既存QUEUE処理とも停止します。稼働確認手順は、署名なし代替API_RECHECKを明示選択した場合に限ります。**

## クイックスタート

Node.js 24を使用する。通常導入ではソース編集が不要。

```sh
npm ci
cp .env.example .env
# .envへ確認済みの既存URL・ID・資格情報を設定する
npm run env:check
npm run check
npm run lint
npm test
npm run build
npm run export:properties
```

`.env.example`の空欄はすべて「未確認」。実際の`.env`と`.local/script-properties.json`は秘密値を含むためGitへ追加しない。`.env.example`だけがGitへ含まれる。環境変数は.envの値より優先されるため、作業シェルに古い同名設定が残っていないことを確認する。Sandboxと本番は別のローカルチェックアウトまたは別の環境ファイルで管理する。

`env:check`は書式・設定漏れの検証のみで、SquareやGoogleへの接続・IDの存在・権限・URLの現在値は検証しない。`export:properties`はローカルファイル作成だけで外部を書き換えない。出力のAUTOMATION_ENABLEDは入力に関わらずfalse。

`GAS_SCRIPT_ID`は新規自動化用GASのIDであり、GASの実行用プロパティには送らない。新規GAS作成後に取得して.envへ設定する。SquareのAPI版の日付はDeveloper Consoleで確認した値を設定し、APIトークンはProduction/Sandboxを一致させる。

## 管理コンソールのセットアップ

今回の管理操作は既存のGitHub / Square Developer Console / Apps Script / Spreadsheetを利用する。独自管理画面のWebアプリやGoogle Sitesページは追加しない。

### 1. GitHubの管理

- リポジトリのPRで実装とCI結果を確認する。GitHubのActionsタブにValidate GuestOps AIが表示される。
- CIは設定用秘密値を必要としない。GitHub SecretsへSquareのトークンを登録する必要もない。
- CIは型検査・ESLint・モックテスト・ビルド・dist差分確認のみ。本番接続・Webhook登録・GASデプロイは行わない。
- `.env`、`.local/`、`.clasp.json`、node_modulesはGit対象外。全実値は管理者のローカル環境とGAS Script Propertiesへ保存する。

### 2. Google Spreadsheet / Apps Scriptの管理

1. 自動化専用Spreadsheetと新規スタンドアロンApps Scriptを用意する。既存の販売資料・GASを編集対象にしない。フォルダ構成や既存IDは変更しない。
2. SpreadsheetのURLから新規IDを取得してSPREADSHEET_IDへ設定。共有は管理担当者だけとし、購入者へ公開しない。シートのタイムゾーン・日時表示はAsia/Tokyoにする。
3. Apps Scriptの「プロジェクトの設定」でスクリプトIDを取得してGAS_SCRIPT_IDへ設定。既存販売用GASのIDではないことを確認する。
4. `npm run env:check`、`npm run build`、`npm run export:properties`を実行する。
5. Apps Scriptエディタにdist/Code.js、dist/Entrypoints.jsを.gsファイルとして転記する。プロジェクト設定でappsscript.jsonを表示して、dist/appsscript.jsonを転記する。Webアプリの入口はEntrypoints.gsのグローバル関数を使う。
6. 「プロジェクトの設定 → スクリプト プロパティ」でBOOTSTRAP_CONFIG_JSONを追加し、`.local/script-properties.json`の**JSON全体を値として**貼り付ける。秘密情報をコードへ貼らない。
7. エディタでconfigureAutomationを実行する。検証後にすべての設定を保存し、AUTOMATION_ENABLED=falseとしてBOOTSTRAP_CONFIG_JSONを削除する。入力不備では保存前に停止する。ソースは設定値を返したり表示したりしない。
8. setupAutomationを実行してGoogle権限を認可する。Orders / Logsが作成され、processQueueの1分トリガーが1個だけ作成される。非互換ヘッダは上書きしない。
9. 左側「トリガー」でprocessQueue・時間主導型・1分間隔を確認し、失敗通知を設定する。「実行数」で失敗履歴を確認する。setupAutomationは実行者ごとのトリガーを確認するため、セットアップと運用は同じ管理者アカウントで行う。
10. 「デプロイ → 新しいデプロイ → ウェブアプリ」で実行者=自分、アクセス=全員を選ぶ。Squareの匿名受信が組織ポリシーで許可されない場合は停止する。得られた新規/exec URLをSquareの通知用に使う。Google Sitesへ埋め込まない。

claspを使う場合は、Google公式CLIを別途導入して管理者本人のGoogleアカウントで認証する。その後`npm run configure:clasp`で新規GAS用の.clasp.jsonを生成できる。生成後はscriptIdを確認してからpushする。手動転記でも全機能を導入できるため、claspは必須ではない。

### 3. Square Developer Consoleの管理

1. 対象アプリを開きSandbox/Productionの選択を確認。アクセストークンのPAYMENTS_READ / ORDERS_READ権限、API版、merchant/location IDを確認する。既存商品の名称・価格・URLを変更しない。
2. 既存5商品のcatalog variation IDを読み取り、環境値に転記する。通常商品3種類と差額2種類を取り違えない。IDが取得できなければ未確認として停止し、金額一致だけで代用しない。
3. 対象アプリのWebhooks / Subscriptionsで**新規購読だけ**追加する。既存購読は編集しない。イベントはpayment.created / payment.updated。
4. 通知先に新規GASの`/exec?key=<WEBHOOK_URL_SECRET>`を設定する。この通知先は新しい自動化用URLであり、既存販売URL・決済リダイレクトとは別。Squareの既存リダイレクト設定は変更しない。
5. SandboxのGAS Script PropertiesでAUTOMATION_ENABLED=trueにして5種類の実決済を確認する。通知履歴で10秒以内の2xx・成功を確認し、保存失敗時の再送も確認する。サンプル送信だけでAPI照合の成功と判断しない。
6. ACCEPTANCE.mdの実環境項目を記録する。Sandbox合格後、別の本番GAS・Spreadsheet・本番トークンで同じ設定作業を実施する。実注文の記録確認後に本番運用へ移行する。

### 4. 日常管理・停止・復旧

- 通常注文はOrdersにRECORDEDとして追加される。納品完了を意味しない。納品・アップセルは既存導線のまま。
- LogsでERRORとQUEUEのFAILEDを確認する。PENDINGが長時間残る場合はGASの実行履歴・権限・クォータを確認する。
- 設定変更前には追加したWebhook購読を停止してstopAutomationを実行する。既存購読は停止しない。
- 新しい.envから再出力し、configureAutomation → setupAutomation → 受入確認 → AUTOMATION_ENABLED=trueの順に再開する。
- 停止中の注文を自動遡及取得する機能はない。停止期間のSquare決済とOrdersを照合し、必要な通知を再送して補完する。
- ロールバックは新規購読の停止、stopAutomation、新規デプロイのアーカイブ。Orders / Logsは削除しない。既存の販売設定はそのまま継続する。

## 今回の整備フェーズ

1. 目的：ZIPの実装をGitHubへ移し、設定値をソース編集なしで投入できる状態にする。
2. 変更ファイル：src/Config.ts、src/Runtime.ts、build.mjs、package.json、.gitignore、README.md、ACCEPTANCE.md、tests/runtime.test.ts、再ビルドしたdist。既存のSquare / Sites / Drive設定は変更なし。
3. 新規ファイル：src/Settings.ts、scripts/environment.mjs、.env.example、tests/environment.test.ts、.github/workflows/ci.yml。その他のZIP内コードは新規リポジトリへ取り込む。
4. 実装コード：loadConfig / loadSettingsが環境値を検証、environment.mjsがローカル設定検証・出力、configureAutomationがScript Propertiesへ停止状態で取り込む。
5. テスト方法：npm run check / lint / test / build。環境値の漏れ・誤設定、秘密値の標準出力防止、出力ファイルの権限、取込み後の停止状態を検証する。
6. ロールバック方法：GitHub反映をrevert。既にGASへ適用した場合は新規購読を停止してstopAutomation。旧版に戻す場合も専用GASの設定・デプロイを確認してから再開する。

## GAS単独のSquare署名検証：確認結果

構成はSquare → GAS Web Appの直接受信を維持する。Cloud Runは追加しない。外部受信口への依存コードはこの導入ブランチから除き、提案専用ブランチ`proposal/cloud-run-signature-relay`へ分離した。既存販売URL/価格/フォルダURLは変更しない。

GAS UtilitiesでHMAC-SHA256計算・base64化は可能。`src/SquareSignature.ts`に計算・比較関数と、Script Propertiesの鍵を取得するverifySquareSignatureFromPropertiesを実装した。Square公式の署名ベクトルで一致を確認した。

しかし標準のSquare署名検証には、通知ごとの`x-square-hmacsha256-signature`ヘッダーが必要。GAS公式Web AppsのdoPost(e)はqueryString、parameter(s)、pathInfo、contentLength、postData等だけを公開し、任意のHTTPヘッダーを取得するサポートされたAPIがない。署名鍵の取得だけでは比較対象が揃わない。このため**サポートされたGAS Web App APIで、Square直接通知の標準署名検証を完成することはできない**。

query/bodyのsignatureを標準ヘッダーとして扱う、存在しないe.headersを仮定する、計算したHMACと自分自身を比較する、API再取得を署名検証と呼ぶ等の回避は行わない。署名検証関数が成功するテストは「署名が別途与えられた場合の計算」を確認するもので、GASが実HTTPヘッダーを取得した証拠ではない。

確認範囲：2026-10-10の公式仕様とローカルテスト。実アカウントのGASへHTTP POSTする実測は未実施（GAS接続・署名鍵・本番実値未提供）。webhookCapabilitiesをGASエディタで実行すると公開APIに基づく能力情報を返す。これはライブ環境のプローブではない。

|選択肢|構成|Square標準署名検証|制約|
|---|---|---|---|
|署名必須のままGAS直接|現構成維持|ヘッダー取得不可|未検証通知を処理せず停止する|
|秘密URL＋Square API再取得|現構成維持|なし|当初選択された代替。通知元認証はできず、秘密URL漏洩時にクォータ消費の可能性|
|署名ヘッダーを取れる受信口|別ブランチの提案のみ|可能|新規サービス・権限・運用が必要。未採用・未デプロイ|

初期値WEBHOOK_VERIFICATION_MODE=REQUIRE_SIGNATUREでは署名取得不可で`SQUARE_SIGNATURE_HEADER_UNAVAILABLE`として停止し、Orders/QUEUE/購入者メールを処理しない。これにより署名要件を満たしたふりで稼働しない。

当初承認済みの署名なし方式を利用する場合だけWEBHOOK_VERIFICATION_MODE=API_RECHECKへ明示変更する。秘密URL＋API照合で記録とメールを行い、LogsへSIGNATURE_UNVERIFIED_API_RECHECKを記録する。これは署名検証の実現ではない。標準署名必須を維持する場合は有効化しない。

### Webhook Signature Keyの取得・保管

Square Developer Consoleの対象アプリでSandbox/Productionを確認し、Webhooks/Subscriptionsの対象購読のSignature Keyを取得する。APIアクセストークンとは別物。取得した実値を.envとGAS Script PropertiesのSQUARE_WEBHOOK_SIGNATURE_KEYへ保存する。チャット/コード/Gitへ貼らない。SQUARE_WEBHOOK_NOTIFICATION_URLはその購読の通知URLを一字一句同じに設定する（秘密クエリを含む場合、そのURLも秘密として扱う）。現時点では実鍵未取得。

## 採用構成

Square payment.created / payment.updated → 新規Apps Script doPost → Logs内QUEUEへ保存 → 1分トリガー → Square決済・注文GET再照合 → Orders記録 → Logs記録。

既存サービス内のGAS直接受信を維持する。初期設定では署名必須のため停止。API_RECHECKを明示した場合のみ当初承認された署名なし代替処理を行う。追加サービス・DB・販売ページは不要。

Google公式のWebアプリイベントには任意HTTPヘッダーがない。Square標準署名検証を実装したと主張しない。秘密URLは署名の代替と同等ではない。漏洩時には不正通知やAPI・GASクォータ消費の可能性がある。通知の金額・メール・商品は無視し、設定された店舗とトークンでAPI再取得した値だけを記録する。

GASの入口はHtmlOutputを同期で返す。ContentServiceはGoogle公式にリダイレクトが明記されているため使用しない。実際のSquare通知が10秒以内の2xxとして成功するかはSandboxで必ず確認する。リダイレクト・Googleのエラーページ・ログイン画面などのHTTP動作はローカルモックでは検証できない。失敗時に例外を投げてもSquareに適切な非2xxが返るかは未確認。**保存失敗時の通知再配信を確認できなければ、本構成で本番稼働しない。構成変更はユーザーと再合意する。**

## 設定一覧（すべて実値は未確認）

`src/Config.ts`が指定のconfigに相当する。全設定は`.env.example`に列挙し、ローカルでは環境変数、GASではScript Propertiesから読み込む。Config.tsやdistへ実値を埋め込まない。GASにはprocess.envや.envの自動読込みがないため、以下の管理コンソール手順で設定を渡す。価格は仕様書の固定値を維持し、価格変更用の環境変数は設けない。

|設定|内容|
|---|---|
|A_URL / P3_URL / P10_URL|既存の通常商品購入URL|
|UPGRADE_P3_URL / UPGRADE_P10_URL|既存の差額購入URL|
|SITE_URL|既存Google Sites URL|
|DRIVE_A / DRIVE_P3 / DRIVE_P10|既存フォルダID（変更しない）|
|DRIVE_A_URL / DRIVE_P3_URL / DRIVE_P10_URL|既存納品URLそのもの。IDから推測して生成しない|
|VARIATION_A / VARIATION_P3 / VARIATION_P10|Squareの既存catalog variation ID|
|VARIATION_UPGRADE_P3 / VARIATION_UPGRADE_P10|既存差額商品のcatalog variation ID|

通常商品の作成・編集は行わない。5種類のvariation IDが別々であることが必要。既存の差額リンクが自由入力のカスタム商品でvariation IDを持たない場合は未対応。勝手に通常商品を改修して解決しない。

Apps Script「プロジェクトの設定 → スクリプト プロパティ」に以下を保存する。トークン・秘密値をコード、チャット、Gitへ記載しない。

|Script Property|設定|
|---|---|
|SQUARE_ACCESS_TOKEN|対象環境のトークン。PAYMENTS_READ / ORDERS_READを確認|
|SQUARE_API_VERSION|Developer Consoleで確認したAPI版の日付。推測の既定値なし|
|SQUARE_ENVIRONMENT|sandbox または production|
|SQUARE_LOCATION_ID|対象店舗ID|
|SQUARE_MERCHANT_ID|対象merchant ID|
|SPREADSHEET_ID|自動化用Spreadsheet ID。既存販売資料のIDを指定しない|
|ADMIN_EMAIL|通知先管理者1名。購入者宛には送らない|
|WEBHOOK_URL_SECRET|暗号学的乱数32バイト以上をbase64url等で43文字以上にする|
|WEBHOOK_VERIFICATION_MODE|REQUIRE_SIGNATURE（初期・停止）またはAPI_RECHECK（署名なし代替）|
|SQUARE_WEBHOOK_SIGNATURE_KEY|対象購読の署名鍵。実値未取得|
|SQUARE_WEBHOOK_NOTIFICATION_URL|対象購読の完全な通知URL|
|BUYER_EMAIL_ENABLED|初期false、案内メールの受入時だけtrue|
|AUTOMATION_ENABLED|初期false、導入確認時true|

Webhook URLは新規Apps Scriptの`/exec?key=<秘密値>`。既存販売URLに追加・変更する必要はない。Squareへ新規Webhook購読を追加するだけ。秘密付きURLは共有資料・ログ・スクリーンショットに出さない。

## 実装と記録

Ordersは「日時 / Square注文ID / メール / 商品 / 金額 / URL / 状態」の7列。日時はSquare注文作成時刻。商品はA / P3 / P10 / UPGRADE_P3 / UPGRADE_P10の管理用キーで、Squareの商品名を変更する意味ではない。URLは対応する既存Drive納品URL、状態はRECORDED（納品完了を意味しない）。

Logsは「日時 / 処理 / 結果 / 内容」の4列。結果はINFO / WARN / ERROR。処理QUEUEの内容JSONには決済ID・試行回数・次回時刻・状態・管理者通知状態を保持する。QUEUE行の内容は更新され、別途PROCESS_PAYMENT等の追記ログが履歴となる。新たなシートは追加しない。生の通知本文、APIレスポンス、購入者メール、秘密値はLogsへ保存しない。

注文は1商品・数量1・JPY・設定店舗・注文ID一致・決済と注文COMPLETED・決済総額/注文総額/商品単価が価格と一致する場合だけ記録する。A 2,980円、P3 29,800円、P10 99,800円、P3差額 26,820円、P10差額 96,820円。複数商品、税・割引・送料で一致しない注文、メールなしなどは未対応として明示的エラー。

A購入履歴の有無による差額購入資格判定は行わない。仕様の完成範囲は購入の記録であり、既存決済を拒否する仕組みは追加しない。

ScriptLockと注文ID照合で同時実行・再送時の二重記録を防ぐ。決済IDでQUEUE重複を防ぐ。Orders保存後にQUEUE更新が失敗して再処理されても、Ordersへ再追記しない。通信例外、429、5xx、未完了注文などは初回＋再試行3回、1/2/4分間隔。確定した価格違い・商品不明・API認証失敗などは再試行で解消しないので即時ERROR・管理者通知にする。

処理は1回最大10件・開始から約3分で打切り、残りは次回。GAS実行時間・URL Fetch・メール・同時実行クォータには依存する。少量運用向けで、Logs全件走査のため大量販売時の処理時間は本番前に測定する。

管理者通知が送信失敗した場合は状態を保存して1時間後に再試行。送信成功直後に状態保存が失敗すると重複通知の可能性がある。Exactly-once送信は保証しない。Sheets自体が利用不能の場合、Logsへの記録・試行回数保存も不能になるため、GAS実行履歴と時間トリガー失敗通知を併用する。購読成功だけを見てシート記録完了と判断しない。

Orders/Logsを並べ替え・削除・編集しながら処理を実行しない。再処理時は停止して対象QUEUEのstate=PENDING, attempts=0, nextAt=0, notified=falseへ修正し、その後再開する。Ordersは重複防止の根拠なので削除しない。

## フェーズ1：コード・設定・ローカル検証

1. 目的：既存資産を変更せず、判定・価格・再試行・重複防止を確認。
2. 変更ファイル：既存ファイルなし。本パッケージの`.env`に確認済み値を転記するだけ。
3. 新規ファイル：package.json、package-lock.json、tsconfig.json、eslint.config.js、build.mjs、src/Config.ts、Types.ts、SquareWebhook.ts、SquareService.ts、OrderService.ts、DriveService.ts、SheetService.ts、Logger.ts、QueueService.ts、Runtime.ts、tests/core.test.ts、sheet.test.ts、runtime.test.ts、square.test.ts、environment.test.ts、src/Settings.ts、scripts/environment.mjs、.env.example、.github/workflows/ci.yml。
4. 実装コード：上記src/*.tsが全実装。DriveServiceはURL選択のみでDriveへの書込みなし。ビルド処理はasync/await・Promiseを使用し、GAS入口とサービス呼出しは同期APIに合わせて同期処理とする。
5. テスト方法：Node.js 24で以下を実行。モック値以外は外部接続しない。

```sh
npm ci
npm run check
npm run lint
npm test
npm run build
```

6. ロールバック：パッケージを削除するだけ。外部資産への影響なし。

## フェーズ2：新規GAS・記録用Sheets準備

1. 目的：処理用の保存先とトリガーを追加する。既存販売資料を変更しない。
2. 変更ファイル：`.env`とScript Propertiesの実値設定。既存外部ファイルなし。
3. 新規ファイル：自動化専用Spreadsheet、新規スタンドアロンApps Script、dist/Code.js、dist/Entrypoints.js、dist/appsscript.json。既存Driveフォルダへの移動・整理は行わない。
4. 実装コード：`Runtime.setupAutomation()`。新規GASへdistの3ファイルを転記する。Code.js/Entrypoints.jsはApps Scriptの.gsファイルとして追加し、appsscript.jsonはマニフェストへ転記。claspを利用する場合は.clasp.example.jsonのscriptIdを新規IDに置換して.clasp.jsonとして保存。既存GAS IDは使わない。Propertiesを設定してAUTOMATION_ENABLED=falseのままsetupAutomationを1回実行、権限を認可する。既存非互換ヘッダは上書きせず停止する。
5. テスト方法：Orders/Logsヘッダ、時間トリガー1個、停止中にAPI・メールが実行されないこと。setupAutomation再実行でトリガーが増えないこと。追加Spreadsheetのタイムゾーン/日付表示をAsia/Tokyoに設定する。
6. ロールバック：stopAutomationを実行。新規GASのデプロイをアーカイブ。専用ファイルは必要なら後で削除する。記録済みデータは保持する。

## フェーズ3：Sandboxで実Webhook受入確認

1. 目的：SquareからGASまでの実HTTPとAPI仕様、保存・再送を検証。
2. 変更ファイル：環境変数とScript PropertiesをSandboxで確認済みの値に設定。実商品・本番価格は変更しない。
3. 新規ファイル：新規GASのWebアプリデプロイとSquare Sandboxの新規Webhook購読。Sandbox検証用資産が必要なら本番資産とは別に用意する。
4. 実装コード：`doPost`と`processQueue`。実行者=自分、アクセス=全員（匿名Square受信可）でWebアプリをデプロイ。組織ポリシーで匿名公開不可なら未対応として停止。/devではなく/execを使う。Square Sandboxでpayment.created/payment.updatedの購読を新規追加し、秘密付きURLを設定。AUTOMATION_ENABLED=trueにする。
5. テスト方法：5商品の実決済通知を送信し、10秒以内に2xx/配信成功となること、1分程度でOrdersへ記録されること、同じ通知再送で注文が増えないこと。通知IDだけのDeveloper ConsoleサンプルはAPI実在決済ではない場合があるので記録の成功確認に使わない。価格違い・variationなし・メールなしはERRORと管理者通知。通信失敗をAPIラッパーのSandbox用一時スタブで再現し、1/2/4分後に計3回再試行、最後に管理者のみ通知。変更したスタブは必ず戻して再ビルドする。

保存不能テストも必須：Sandbox専用コードでenqueue直前に例外を発生させ、通知が成功扱いにならずSquareが再送するか確認。ロック競合でも未保存通知の再送を確認。HtmlOutputの応答、例外のHTTPコード、リダイレクト有無、メール取得率、税設定、variation取得可否、実行クォータを受入記録に残す。いずれも現時点は未確認。

6. ロールバック：Sandboxの追加購読を無効化しstopAutomation。既存販売導線へ影響なし。

## フェーズ4：本番導入・監視

1. 目的：選択した検証モードの受入条件がすべて通った実装だけ本番へ接続し、手入力を削減。
2. 変更ファイル：本番環境変数・Script Properties。本番Squareは新規Webhook購読追加のみ。販売商品や既存購読・URLは変更しない。
3. 新規ファイル：本番専用GAS・Spreadsheet・Webhook購読。Sandboxと分離して誤記録を防ぐ。
4. 実装コード：同じdistを使用。停止状態でsetupAutomationし、Webデプロイ・購読を確認してから有効化。新しいGASバージョンを公開し、コード変更時はデプロイの版更新が必要。Script Propertiesの値変更は再ビルド不要だが、必ず停止中に行って再確認する。
5. テスト方法：実運用の次の注文とSquareを照合し、注文ID・メール・商品・金額・納品URLが一致。少なくとも5商品、異常系、通知重複の受入表が合格してから完成扱い。初期は毎日Square決済件数とOrdersを照合し、PENDINGが10分以上残る件・FAILED・GAS失敗履歴を確認。通常運用の人間時間は例外確認のみへ削減する。
6. ロールバック：追加した本番Webhook購読だけを無効化→stopAutomation→デプロイをアーカイブ。Orders/Logsを保持し、停止中決済はSquareから別途照合・再投入する。既存販売は継続する。

## 根拠資料

2026-10-10確認。利用API version、実アカウント設定、Webhook実応答は未確認。

- [Google Web Apps：イベント構造・戻り値](https://developers.google.com/apps-script/guides/web)
- [Google Content Service：リダイレクト](https://developers.google.com/apps-script/guides/content)
- [Square Webhooks：10秒応答・重複・再送](https://developer.squareup.com/docs/webhooks/overview)
- [Square署名検証：ヘッダー・URL・本文](https://developer.squareup.com/docs/webhooks/step3validate)
- [Square Payment](https://developer.squareup.com/reference/square/objects/Payment)
- [Square RetrieveOrder](https://developer.squareup.com/reference/square/orders-api/RetrieveOrder)

Stripe、CRM、月額、ライセンス、専用ページ等は本実装へ追加していない。将来はSquareReader、OrderRecord、独立サービスを拡張し、現行導線の変更を必要としない設計とする。

## 購入商品別のDrive案内メール

BUYER_EMAIL_ENABLED=trueにしたAPI_RECHECK運用では、Square APIで確認した購入者メールへ既存Drive URLを案内する。Aメールだけ既存のP3/P10差額リンクも含む。返信先はADMIN_EMAIL、送信元はGAS管理者アカウント。Driveの共有変更は行わず、既存共有設定で購入者が閲覧できるかは管理者が確認する。

Orders状態を送信前にDELIVERY_SENDING、成功後DELIVEREDとして保存する。送信結果不明はDELIVERY_REVIEWまたはDELIVERY_SENDINGを維持し、管理者通知へ回す。既送信を自動再送しない。MailAppのクォータ不足で未送信が確実な場合は既存の再試行3回を使う。購入者による閲覧完了は保証しない。

管理者は送信結果不明の注文をGmail送信済みと照合し、既送信ならDELIVERED、未送信が確定した場合だけRECORDEDへ変更し対応QUEUEをPENDING/attempts=0/nextAt=0/notified=falseへ戻す。編集前にGASを停止する。メール無効時の過去注文を自動遡及送信する機能はない。

## 今回の修正フェーズ

1. 目的：既存の直接受信を維持し、GAS署名計算とヘッダー取得不可を区別する。
2. 変更ファイル：Runtime.ts、Settings.ts、build.mjs、package.json、.env.example、README、ACCEPTANCE、テスト、CI、dist。外部販売資産の変更なし。
3. 新規ファイル：SquareSignature.ts、tests/gas-signature.test.ts。外部署名受信コードは提案ブランチへ分離し導入ブランチから削除。
4. 実装コード：verifySquareSignatureFromProperties、directSquareSignature、webhookCapabilities、GAS直接doPost。署名必須は取得不可なら停止。
5. テスト方法：npm run check/lint/test/build。公式署名ベクトル、秘密URL不一致、署名必須で記録/メールが発生しないこと、API再取得と商品メールを確認。
6. ロールバック：GASと追加購読を停止し、必要なら直前の直接受信版へ戻す。Cloud案へ無断切替しない。送信状態と注文履歴は保持する。
