# GAS直接受信・署名検証の確認結果

2026-10-10（Asia/Tokyo）

- 構成：Square → GAS Web Appを維持。Cloud Run資産の追加・デプロイなし。
- GASでHMAC-SHA256/base64計算は可能。Square公式署名ベクトルに一致。
- Script Propertiesから署名鍵と通知URLを読む関数を実装。
- GAS公開doPostイベントには任意HTTPヘッダー取得APIがない。標準Square署名の比較対象を直接取得できない。
- 初期REQUIRE_SIGNATUREでは受信と既存QUEUEを処理せず停止。API_RECHECKは署名なし代替であり、検証成功とは扱わない。
- 77件のローカルテスト成功。型検査・ESLint・GASビルド成功。
- Cloud案はproposal/cloud-run-signature-relayへ提案として分離。未採用。

|実環境確認|結果|
|---|---|
|Webhook Signature Keyの実値取得|未実施：Squareの接続・実値未提供|
|GAS実アカウントへHTTP POSTしてイベントを実測|未実施|
|本番Webhook受信・応答/失敗再送確認|未実施|
|既存商品variation・金額・購入者メールの実取得|未実施|
|購入者メールの実受信・既存Drive閲覧確認|未実施|
|本番有効化|未実施|

根拠：Google Web Apps request parameters、Square Webhook signature validation。READMEに原典と比較表あり。
既存のSquareリンク・価格・Google Sites・Drive URL/ID/共有権限は変更していない。
