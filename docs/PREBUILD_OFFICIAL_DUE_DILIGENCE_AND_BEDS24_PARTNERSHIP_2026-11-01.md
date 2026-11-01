# 事業構築前の公式確認ゲート / Beds24 partnership (2026-11-01 JST)

## 全事業共通の開発前調査（社内運用ルール）
新規プラットフォーム・API・決済・個人情報・マーケットプレイスに依存する機能の開発・顧客操作依頼より前に、公式一次資料で以下を検証する。
1. 利用規約、商用提供可否、登録・承認・契約・審査・料金
2. 公式API機能範囲と未対応機能、APIレート制限、トークン/権限、監査・セキュリティ
3. 顧客の初期操作、既存資産との互換性、アカウント/GAS追加の要否
4. 代替案と移行方法、営業・料金・サポートの採算
5. 不明な事項は事業者に書面照会し、回答までは「承認済み」「本番可能」と表示しない

## Beds24一次情報
- https://wiki.beds24.com/index.php/API_V2.0 : 通常API V2はinvite code, marketplace accessはsupport ticket→organization token form。
- https://wiki.beds24.com/wikitest/index.php/Marketplace_for_Integration_Partners : パートナー申請→審査/契約→partner account→marketplace listing→organization token。
- https://www.beds24.com/reseller.html : Integration Partner申込窓口。

## 送付前の照会項目（未確認）
- 個人事業主による申請の可否、日本からのサービス提供の可否
- marketplace未承認で、顧客招待コード方式の有料SaaS提供が許される条件
- 審査・契約書、掲載料、初期費、継続費、レベニューシェア、審査期間
- Organization tokenの発行と顧客有効化フロー、権限・施設ごとの隔離、失効
- 予約変更/キャンセルのwebhook、OTAメッセージ返信・料金更新/在庫操作の対応APIと権限
- パートナーのAPI credit / limit and quota、試験用アカウント、サポート窓口

## ブロッカー
Beds24からの書面回答およびパートナー契約の確認前に、Beds24公式認定・Marketplace掲載済みと宣伝しない。
葛西実証ではBooking.com有効予約10件・21泊とBeds24過去取得0件の不一致が解消するまでOTA切替・在庫/料金の書込を行わない。
顧客へ新規Gmail、GAS作成、コードの貼付を要求しない。
