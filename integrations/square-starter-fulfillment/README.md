# Starter Kit 9,800円｜Square決済照合→Gmail教材納品（Google Apps Script）

**状態（2026-10-30 JST）:** ソース実装・単体検査済み。Square本番接続・GAS配備・トリガー登録・実メール納品は**未実施**。無断で課金・料金変更・送信しません。

## 動作
- Square **Payments API（読み取り専用）**で決済一覧を取得し、**COMPLETED／JPY 9,800円／指定店舗／返金なし／設定開始日時以降**を検査。
- Square **Orders API（読み取り専用）**で注文の**単一商品・数量1・指定catalog_object_id・合計9,800円・キャンセル／下書き注文の除外**を再検査。商品名の曖昧一致やメール通知の文字列だけで納品しない。
- 購入者メールアドレスがPaymentに存在する場合だけ対象にする。未取得の場合は**自動納品をスキップ**（Square管理画面で別途確認）。
- 送信前にScript Propertiesへ**注文IDを先に** `PENDING` として記録し、次に決済IDを記録する。注文ID側の記録が失敗した場合はメールを送らない。決済ID側の記録だけが失敗した場合も注文ID側の `PENDING` が残り、次回の二重納品を阻止する。Gmail下書きの送信後に返された**GmailメッセージID**を取得できた場合だけ、注文ID→決済IDの順で `SENT <UTC日時> MSG:<GmailメッセージID>` に更新する。IDが取得できない場合は `PENDING` のまま自動再送を禁止する。同一注文に複数の決済IDが存在しても二重納品しない。
- 初期値は `SEND_ENABLED` 未設定＝**送信禁止（dry run）**。課金・注文変更・Square設定変更をするAPIは一切呼ばない。

## 既存環境への最短導入
1. 民泊AI実務キット運営窓口（`minpaku.ai.kit@gmail.com`）で**既存のApps Scriptプロジェクト**を開く。別のGoogleアカウントでの実行はコード側で拒否。
2. `Code.gs` の内容を**既存コードを消さない別ファイル**（例：`StarterFulfillment.gs`）として追加する。同名関数がある場合は統合時に確認。
3. プロジェクト設定 → スクリプト プロパティへ次のキーを登録（**トークンや購入者用URLをGitHubにコミットしない**）。

| キー | 設定内容 |
|---|---|
| `SQUARE_ACCESS_TOKEN` | 読み取り権限 `PAYMENTS_READ`・`ORDERS_READ` を持つSquare本番アクセストークン |
| `SQUARE_LOCATION_ID` | Starterを販売しているSquare店舗のlocation ID |
| `STARTER_CATALOG_OBJECT_ID` | Square商品「Starter Kit 9,800円」の**variation** catalog_object_id（名前ではなくID） |
| `FULFILL_SINCE_ISO` | 監視開始UTC日時。例 `2026-10-30T00:00:00Z`。開始前の決済は送信対象外 |
| `STARTER_GUIDE_URL` | 既存の購入者用「利用ガイド」のGoogle Docs URL |
| `STARTER_PROMPT_URL` | 既存の購入者用「施設専用マスタープロンプト」のGoogle Docs URL |
| `STARTER_SHEET_URL` | 既存の購入者用「施設情報設定・20場面判断・初回テスト」Google Sheets URL |
| `SEND_ENABLED` | **最初は `false`**。Square照合結果・受取権限・実決済テストを確認できた後だけ `true` |

4. `testStarterFulfillmentRules()` を実行し、18ケースの `PASS` を確認。GitHub Actionsでは `test-fulfillment.cjs` により、注文単位の二重納品防止・再実行・PENDING・dry runも自動検査する。
5. **送信を有効化する前に** `auditStarterFulfillment()` を実行。これはSquareの決済・注文を読み取り、集計値だけをログに出す。`SEND_ENABLED=true` でもメール送信・Script Properties書込は行わない。`readyToDeliver` は送信候補数であり、実送信数ではない。`pendingReview` が1件でもあれば自動再送しない。`invalidOrders` は商品・金額・注文状態などが一致しない注文の件数。購入者メールアドレスやトークンはログに出さない。
6. `runStarterFulfillment()` を**送信無効のまま**実行。実Squareデータの読取可否と対象商品の識別をログで確認する。
7. 購入者用3ファイルが「リンクを知っている全員／閲覧者」であることを確認（2026-10-30にDrive APIで3件とも確認済み）。
8. 本番接続・受取先・決済の整合性を検証後、`SEND_ENABLED=true` とし、`runStarterFulfillment` の時間主導型トリガー（15分毎など）を登録する。**この手順は未実行**。

## 安全停止と例外処理
- 送信を止めるときは `SEND_ENABLED=false`。トリガーを消さなくても送信しない。
- `PENDING` のままの決済・注文は自動再送しない。Gmail送信済みとSquare決済ID・注文IDを照合してから対応。
- 決済金額が違う、複数商品、返金、メール未登録、商品ID不一致、API権限不足の注文は**送信しない**。
- Square APIは結果整合性に時間差があるため、時間主導型トリガーで次回取得する。最大10ページ超過はエラーで停止。
- Square APIの利用条件や料金は変更しない。Apps Scriptは本番導入前に運用環境の権限・制限を確認する。

## 参照仕様（Square公式）
- Payments API: https://developer.squareup.com/reference/square/payments-api/list-payments
- Payment: https://developer.squareup.com/reference/square/objects/payment
- Orders API: https://developer.squareup.com/reference/square/orders-api/retrieve-order
- 金額単位（JPYは円）: https://developer.squareup.com/docs/build-basics/common-data-types/working-with-monetary-amounts

**重要:** コードとモックによる単体・統合テストの完成は、Square本番の自動納品稼働を意味しません。必要な認証情報・店舗/商品IDがこの実行環境に無いため、実Square API呼び出しや送信は行っていません。

## 2026-10-30 追加検証
- 読取専用の `auditStarterFulfillment()` を実装。模擬決済2件・同一注文1件で `readyToDeliver=1` を確認。
- `SEND_ENABLED=true` の状態でも監査実行によるGmail送信0件・Script Properties書込0件を確認。
- キャンセル注文の納品除外、模擬送信1回後の再実行で重複送信0件を確認。
- これは**モックによる実行検証**であり、Square本番API接続、GAS配備、購入者への実送信の成功ではない。

## 2026-10-30 追記：途中書込失敗の安全性
- `setProperty` の途中失敗を模擬したテストを追加。注文IDの `PENDING` 保存後に決済ID保存が失敗した場合、Gmail送信は0件で、次回実行も送信を阻止することを確認。
- `PENDING` は納品完了の証拠ではない。解除前にSquare注文番号・Gmail送信済み・購入者宛先を突き合わせる。確認が取れない場合は自動再送しない。
- GitHub Actionsはコード変更時に `test-fulfillment.cjs` を実行する。実環境のSquare/GAS稼働検証とは区別する。

## 2026-10-30 追記：Gmail送信IDの証跡
- `GmailApp.sendEmail` は送信したメッセージのIDを返さないため、`GmailApp.createDraft(...).send()` に変更し、返却される `GmailMessage.getId()` を注文・決済両ガードへ記録する。
- 送信APIが成功してもメッセージIDが空の場合、送信済みを推定せず `PENDING` のまま停止する。手動確認前の再送は禁止。
- モック実行で適格性18条件、送信IDの両ガード保存、再実行時の二重送信防止、ID欠落時の停止・再送防止を確認。**GAS本番実行・Gmail実送信・Square本番接続は未確認**。
- 送信IDをGoogle Sheets台帳に転記する自動同期は未実装。現段階ではScript Propertiesの `GO_SENT_...` に記録される（キーは決済ID/注文IDのSHA-256）。
