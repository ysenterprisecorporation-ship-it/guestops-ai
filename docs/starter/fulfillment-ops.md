# GuestOps Starter Kit｜決済・納品オペレーション（内部用）
更新: 2026-10-30 JST

## 販売情報
- 商品: GuestOps Starter Kit / 9,800円・買い切り
- 決済導線: https://ysenterprisecorporation-ship-it.github.io/guestops-ai/starter/order/
- 購入者への送付元: minpaku.ai.kit@gmail.com
- 実決済・決済後のSquareリダイレクト・購入者権限は未検証。完了扱いにしない。

## 検証と納品の順序
1. Square管理画面の決済済み注文から、注文番号・決済金額・購入者メール・決済日時を確認する。メール通知のみで決済成立を推定しない。
2. 同じ注文番号・メールについて過去の納品記録が存在すれば二重送信しない。
3. 以下の購入者教材が利用可能か、閲覧権限とリンクを確認する。購入者に編集権限を付与しない。
4. 決済済み購入者にのみ教材リンクを送付し、送信メッセージIDを記録する。
5. 送付後、リンク切れ・受信不達・アクセス拒否の連絡を追跡し、再納品する際も注文番号を照合する。

## 教材リンク（購入者のみ案内）
- 利用ガイド: https://docs.google.com/document/d/1MjTNyh8hjvJW5Eg2wsaRPgfMQ1nWazbs_qazdkSNNjQ/edit
- 施設専用マスタープロンプト: https://docs.google.com/document/d/1SHotxS2tvQuxHSGRS4SJMqUNhKSe-W_tukvEbuZ7xuQ/edit
- 施設情報設定・20場面判断: https://docs.google.com/spreadsheets/d/1X5qCRw7wOjsusOUVopX2_735z0r-WMwUDC2-Hp7Zb8c/edit

## 記録列
注文番号 / 決済日時 / 購入者メール / 決済確認日時 / 教材権限確認 / メール送信日時 / Gmail送信ID / 配信状態 / 再送理由

## ②への移行
Starter購入後30日以内に②有償契約成立なら9,800円を初月料金に充当（初月料金を上限、現金返金・翌月繰越なし）。施設数・提供機能・課金開始日を合意するまで継続課金を開始しない。

## 禁止
未決済・未確認での納品、購入者へのカード番号要求、Square URLを営業メールへ記載、②の未実装機能を実装済みと説明する行為。
