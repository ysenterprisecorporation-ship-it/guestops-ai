# 決済通知漏れの補完（初期停止・手動実行）
既存Squareの商品・価格・決済リンク、GAS直接構成を維持する。新しい決済、メール送信、返金、Webhook変更をこの関数では行わない。

## 対象と手順
実GASへ更新されたdist/Code.jsとdist/Entrypoints.jsを同期してから使用する。既存Script Propertiesの設定が必要。
AUTOMATION_ENABLED=true、WEBHOOK_VERIFICATION_MODE=API_RECHECK、RECONCILIATION_ENABLED=trueがすべて必要。既存の停止設定をコードで変更しない。RECONCILIATION_ENABLED未設定では停止する。

RECONCILE_BEGIN_UTCとRECONCILE_END_UTCへ確認対象をUTCのISO日時で指定する。最大24時間・未来不可。初回RECONCILE_CURSORは空欄。
GASエディタからreconcilePaymentsを実行する。時間トリガーには追加しない。
Squareから1ページ最大100件を取得し、COMPLETED・対象店舗を確認した上で決済と注文をAPIで再取得する。既存の商品variation・数量・金額・メールの検証に合格するものだけ既存QUEUEへ登録する。
hasMore=trueなら同じ期間で再実行する。カーソルを保存し、期間が異なるカーソルは拒否する。ページ途中で通信失敗した場合はカーソルを進めず、再実行時の重複は既存QUEUEで防ぐ。
実行後RECONCILIATION_ENABLED=falseへ戻す。登録後の記録・納品は既存processQueueに従う。補完処理だけで納品完了とはしない。

## 注意
集計はqueued/duplicates/skipped/review/hasMoreのみ。購入者情報・トークン・カーソルは返さない。
PRODUCT_UNKNOWNは対象外としてスキップ。それ以外の確定不整合はreviewへ数える。通信・API一時エラーは処理を中断する。
内訳を一覧化していないためreview>0の実注文確認はSquare側で行う。既存検証で未対応の税・値引き・送料・複数商品などは自動で受け入れない。
自社テストと実顧客はこの関数で区別できない。queued件数を売上実績や利益として扱わない。
API結果は遅れて反映される場合があるため、同じ期間の再照合が必要な場合がある。最終ページ取得は実顧客売上の証明ではない。

## 検証
ローカル100テストPASS、型検査・lint・GASビルド成功。
実トークン通信、実GAS同期、実注文登録・納品は未実施。

API根拠：https://developer.squareup.com/reference/square/payments-api/list-payments
