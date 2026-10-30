# Starter Kit 9,800円｜Square決済照合→Gmail教材納品（Google Apps Script）

**状態（2026-10-30 JST）:** ソース実装・単体検査済み。Square本番接続・GAS配備・トリガー登録・実メール納品は**未実施**。無断で課金・料金変更・送信しません。

## 動作
- Square **Payments API（読み取り専用）**で決済一覧を取得し、**COMPLETED／JPY 9,800円／指定店舗／返金なし／設定開始日時以降**を検査。
- Square **Orders API（読み取り専用）**で注文の**単一商品・数量1・指定catalog_object_id・合計9,800円・注文状態 `COMPLETED` 必須（`OPEN`・`CANCELED`・`DRAFT`・状態欠落は除外）**を再検査。商品名の曖昧一致やメール通知の文字列だけで納品しない。
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

4. `testStarterFulfillmentRules()` を実行し、23ケースの `PASS` を確認。GitHub Actionsでは `test-fulfillment.cjs` により、注文単位の二重納品防止・再実行・PENDING・dry runも自動検査する。
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

## 2026-10-30 06時台：監査の診断力・異常応答停止を強化
- Square Payments APIがHTTP 200でも `payments` に配列以外を返す、`cursor` が文字列でない、または `errors` 配列にエラーがある場合、**0件と誤認せず例外停止**。決済一覧が空で `payments` フィールドが省略される正常ケースは許容。
- 読取専用 `auditStarterFulfillment()` に `rejectedPayments` と内訳（`refundedPayments`、`missingBuyerEmail`、`unsettledPayments`、`otherRejectedPayments`）を追加。購入者のメールアドレス・氏名・注文番号をログ出力しない。
- 集計は**拒否理由を優先順位で一つに分類**するため、個別の理由が複数ある注文も内訳の合計は `rejectedPayments` と一致する。対象決済が複数ある同一注文は `eligiblePayments` と `uniqueEligibleOrders` が異なり得る。
- GitHub上の模擬テストに、拒否理由4種、異常レスポンス3種、正常な空レスポンス、異常レスポンス時の送信・記録ゼロを追加。本番Squareへのアクセスや実購入者への送信は実施していない。

## 2026-10-30 07時台：異常JSON・ページネーション停止条件

- Squareの決済一覧がHTTP 200でも、トップレベルがJSON配列、`errors` が配列以外、`payments` がnullなど、API仕様外の応答なら**納品処理を例外停止**する。空の `payments: []` と `errors: []` は正常として扱う。
- Squareが同一のページネーション `cursor` を繰り返した場合、納品処理と読み取り専用監査の両方を停止する。これにより同一ページを延々と取得する状態を防止する。
- GitHub上の `test-fulfillment.cjs` に異常JSONと繰返しcursorの回帰テストを追加。
- 今回は取得した最新版 `Code.gs` をJavaScript実行環境に読み込み、**既存18適格性チェックと新規6回帰チェックの成功**、模擬Square取得4回、Gmail送信0件、Script Properties書込0件を確認。GitHub Actionsジョブの成功・Square本番接続・GAS本番配備は未確認。

## 2026-10-30 08時台：注文状態の誤納品防止

- Square公式のOrderState定義では、`OPEN` は更新可能な注文、`COMPLETED` は全額支払い済みの終端状態。決済単体が `COMPLETED` でも、注文側が `OPEN` または状態不明なら購入者教材を送らないよう、`goOrderEligible_` の判定を厳格化。
- `testStarterFulfillmentRules()` の判定を18件から20件に増やし、`OPEN`・状態欠落を拒否するケースを追加。
- Node.jsテストにも、`OPEN`・状態欠落の注文が監査で `invalidOrders` となり、送信処理を実行してもメールや納品ガードが作成されない回帰検証を追加。
- 今回の実行環境で最新版 `Code.gs` をJavaScript実行し、23件の適格性チェック、`OPEN`・状態欠落の拒否、`COMPLETED` の模擬納品1件と再実行時の重複0件を確認。実Gmail送信は0件。GitHub Actionsジョブ自体の実行成功・本番Square接続は未確認。
- 仕様参照: https://developer.squareup.com/reference/square/enums/OrderState


## 2026-10-30 09時台：注文全体の返金・返品チェック
- Square Paymentが`COMPLETED`でも、同じ注文に別決済の返金や後日の返品が記録される可能性を考慮し、Orderの`refunds`・`returns`が非空なら納品候補から除外する。両フィールドが欠落する正常な注文は従来どおり扱う。フィールドの型が不正な場合も納品しない。
- GASの適格性チェックを23条件に拡張し、モック統合テストに返金注文・返品注文・不正な返金フィールドの監査除外とGmail送信阻止を追加。
- この変更はSquareの返金・注文データを変更しない。GitHubでのコード・テスト更新と、Square本番環境での動作確認は区別する。

## 2026-10-30 10時台：決済一覧取得後の返金・宛先変更レース対策

- 決済一覧の内容は取得時点のスナップショット。注文照合後、**送信直前に同一決済IDをPayments APIで再取得**し、COMPLETED・9,800円・店舗・注文ID・返金なし・購入者メールアドレスの一致を再検査する。照合に失敗した場合は、Gmail送信と納品ガード作成の前に停止する。
- SEND_ENABLED=false のdry runは従来どおり読み取り専用で、送信前の再取得は行わない。auditStarterFulfillment() の集計は候補のスナップショットであり、実送信確約ではない。
- コードに模擬決済の直前返金、宛先変更、再取得結果欠落、正常な再取得後の一度だけの納品を検査する回帰テストを追加。
- **検証範囲：** GitHub上の更新後 Code.gs を再取得し、V8上の模擬Square/Gmail環境で既存23判定、返金・宛先変更・再取得欠落の送信阻止、正常時1件・再実行時0件を確認。実Gmail送信0件。Node.jsの test-fulfillment.cjs 全体およびGitHub Actions実ジョブの成功はこの実行では未確認。
- 送信前の再取得でも、外部システムの変更と送信を完全に原子的にはできない。GAS本番配備、Square本番接続、購入者への実納品は依然未完了。

## 2026-10-30 11時台：GASのdry-runトリガーを1操作で設定する補助機能

- `Deployment.gs` を `Code.gs` と同じApps Scriptプロジェクトへ追加すると、`getStarterDeploymentStatus()` で**不足する設定キー名・送信フラグ・トリガー数**のみを確認できる。トークン値や購入者情報は出力しない。
- `installStarterDryRunTrigger()` は、`SEND_ENABLED=false` を必須とし、**Squareの読み取り専用監査が成功した場合に限り**、15分間隔の `runStarterFulfillment` トリガーを最大1個作成する。同じ関数を再実行しても重複作成しない。複数トリガーが既存の場合は停止し、自動削除しない。
- `pauseStarterFulfillment()` は実行中処理との競合を避けるためロック取得後に `SEND_ENABLED=false` を保存する。Square・決済・価格・既存トリガーを変更しない。
- **本番自動送信は有効化しない。** トリガー設置後も `SEND_ENABLED=false` の間はdry run。実購入者への自動納品の開始は、決済・受取権限・送信先の本番検証後に別途判断する。
- `test-deployment.cjs` に初回設置、二重設置防止、送信有効時の設置拒否、緊急停止、既存トリガー重複、実行アカウント不一致、監査失敗を追加。GitHub Actionsにも組み込んだ。**GitHubへの実装とGAS本番配備は別工程であり、本番トリガーは未作成。**
- `.github/workflows/verify-starter-fulfillment.yml` に残っていた旧テスト件数「8」を、現在の23件に修正。これまでの古い固定値による誤失敗を解消するための修正であり、GitHub Actions実行成功は別途確認が必要。

**本番導入の順序：** ①既存GASに2つの `.gs` ファイルを追加 → ②Script Propertiesを設定（`SEND_ENABLED=false`）→ ③`getStarterDeploymentStatus()` → ④`installStarterDryRunTrigger()` → ⑤監査結果と実決済・教材受取条件を確認。**⑤が終わるまで送信フラグは変更しない。**

## 2026-10-30 14時台：注文の送信直前再取得

- 送信有効時は、一覧からの注文照合に加えて、決済の再取得後に**同じ注文IDを再取得**する。注文の `COMPLETED` 状態、指定商品、数量、JPY 9,800円、返金・返品なしを再検証してから `PENDING` を保存する。
- 最初の注文取得後に返金・キャンセルされたケースは、Gmail送信・Script Propertiesの納品ガード作成前に例外停止する。注文状態が変わらなかった場合のみ既存の二重送信防止処理に進む。
- `test-fulfillment.cjs` に送信直前の注文返金・キャンセル・正常注文の回帰ケースを追加。ソースの構文検査および実コードのモック実行では、返金・キャンセルでGmail送信0件、正常注文で模擬送信1件を確認。
- 本番Square接続・GAS配備・実Gmail送信の成功を意味しない。外部APIとGmail送信は原子的な一取引ではないため、再取得後のごく短い時間差は残る。送信有効化には別途本番確認が必要。

## 2026-10-30 15時台：購入者用教材リンクの取り違え防止とCI修正

- `goRequiredConfig_` は、利用ガイド・マスタープロンプトを Google Docs の `/document/d/<fileId>`、施設情報設定シートを Google Sheets の `/spreadsheets/d/<fileId>` として検証する。3件で同一ファイルIDが重複する場合も、送信処理前に例外停止する。URLの型・IDの整合性検査であり、実際の閲覧権限やファイル内容を確認したことにはならない。
- `test-deployment.cjs` に Docs/Sheets の種類の取り違えと、同一教材IDの二重指定を拒否する回帰ケースを追加。外部送信・決済変更は行わない。
- GitHub Actions `verify-starter-fulfillment.yml` の完了メッセージ検査を、現在の `testStarterFulfillmentRules()` が実際に出力する文言へ修正。旧ワークフローの `PASS: 23 safe fulfillment checks` は現行コードのログと一致していなかった。
- この更新はGitHubのコード・テスト・手順書の変更であり、GAS本番配備・Square本番API接続・実購入者へのメール送信ではない。GitHub Actionsの実ジョブ成功は別途確認する。

## 2026-10-30 21時台：実行中の緊急停止を即時反映

- 従来の `pauseStarterFulfillment()` は送信処理と同じScriptLockを待つため、処理中に停止指示を出しても当該実行が終わるまで `SEND_ENABLED=false` を保存できなかった。
- 緊急停止関数はロック待ちをせず、Script Propertiesの `SEND_ENABLED=false` を直ちに保存する方式に修正した。価格・注文・Square API・トリガーは変更しない。
- `runStarterFulfillment()` は送信有効フラグを開始時に一度読むだけでなく、**Square再照合後・納品ガード作成前**と、**PENDINGガード作成後・Gmail実送信前**に再取得する。停止指示を検知したら送信しない。
- PENDING記録後に停止した注文は、誤再送防止のためガードを残す。再開時も自動送信せず、注文・送信履歴を照合してから個別判断する。**Gmail送信処理が既に開始した後の取消しは保証できない。**
- 回帰テスト：実行中のロック保持状態での停止フラグ保存、PENDING記録直後の停止でGmail 0件・自動再送0件、決済再照合中の停止でPENDING 0件・Gmail 0件を追加。
- GitHubへのソース反映は完了。本番GASプロジェクトへの配備・Square本番API通信・実購入者へのメール送信は**未実施**。実際の停止効果は配備後に検証する。

## 2026-10-30 23時台：購入者メールアドレスの複数宛先混入防止

- Squareの `buyer_email_address` は購入者向け教材の送信先に使うため、従来の「@とドットがある」だけの検査では不十分。例：`buyer@example.com,attacker` のような文字列は旧検査を通過し、Gmailの宛先解析に渡るおそれがあった。
- `goBuyerEmailValid_` を導入し、**ASCIIの単一メールボックス形式のみ**を受理する。カンマ・セミコロン・表示名構文・連続ドット・不正ドメインは拒否。プラスアドレスは許容する。
- 納品判定と読取専用監査で同じ検査を使用。異常アドレスは `missingBuyerEmail` の集計に分類し、**Gmail下書きもPENDING記録も作らない**。国際化アドレス等で検査対象外になった場合は自動送信せず個別確認する。
- `testStarterFulfillmentRules()` に検査ケースを追加し、`test-fulfillment.cjs` に異常アドレス5例の**送信0件・納品ガード0件**を検査する回帰ケースを追加。
- **検証範囲：** GitHubへコード・回帰テストをコミットし、取得した実コードの単一アドレス検査7例と不正Payment除外を実行確認。本番GAS配備・実Gmail送信・Square本番通信は未実施。GitHub Actions全ジョブの成功は別途確認が必要。
