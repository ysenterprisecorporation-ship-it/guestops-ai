# Cloud Runによる署名受信口：提案のみ

未採用・未デプロイ。既存のSquare → GAS直接構成へ適用しない。このブランチは署名ヘッダーを取得する代替受信口を検討するために分離した。

## GASだけでは成立しない理由

Square標準署名には通知ヘッダー x-square-hmacsha256-signature、購読の署名鍵、通知URL、raw bodyが必要。GAS UtilitiesはHMACを計算できるが、GAS Web Appsの公開doPostイベントにHTTPヘッダー取得APIがない。署名鍵だけを取得しても比較対象の署名を得られない。

公式資料：
- https://developers.google.com/apps-script/guides/web#request_parameters
- https://developer.squareup.com/docs/webhooks/step3validate

公式仕様とローカルHMACテストで確認。実アカウントのGAS HTTP実測は未実施。

## 比較

|案|現構成維持|標準署名検証|追加運用|
|---|---|---|---|
|GASで署名必須のまま停止|はい|署名ヘッダー取得不可|追加なし。購入処理は稼働不可|
|秘密URL＋Square API再取得|はい|なし|URL秘密管理。通知元を認証できない|
|Cloud Run署名受信口→GAS|いいえ。明示合意が必要|可能|Cloud Run/シークレット注入/IAM/課金/監視|
|既存署名対応サーバー→GAS|いいえ。明示合意が必要|可能|既存サーバーの管理・TLS・監視|

## 提案の実装

receiver/にNode.js 24の受信モジュールがある。Square raw body署名を検証してからHMAC付き通知をGASへ転送し、GAS側の永続保存応答を検証した場合だけ200を返す。GASのHTMLエラーページを保存成功と誤認しない。

採用時の候補：Cloud Runに受信口を1つ配置し、対象URLで新規Webhook購読を追加する。Square商品/販売リンク/リダイレクト、Sites、DriveフォルダURLや権限は変更しない。署名鍵・転送鍵は受信ホストではSecret Manager等の秘密注入、GASではScript Propertiesに保存する。

Cloud Runプロジェクト、リージョン、課金、サービスID、権限、秘密値は未指定。資産作成・秘密値登録・課金設定変更・デプロイは行っていない。合意前にこのブランチを導入ブランチへマージしない。

## 段階とロールバック

目的：直接GASで取得できない署名ヘッダーを認証済み通知としてGASへ渡す。
変更ファイル：この提案ブランチ内のRuntime/Settings/build/README等。直接構成ブランチの変更なし。
新規ファイル：receiver/、RelayProtocol/RelayService、署名/転送テスト。コードは当ブランチに同梱。
テスト：Square公式署名ベクトル、改変拒否、GAS署名付き保存応答、不正応答時503。実Webhookは採用・設定後に確認する。
ロールバック：新規購読と新規受信口を停止しGASを停止。既存販売資産に影響しない。
