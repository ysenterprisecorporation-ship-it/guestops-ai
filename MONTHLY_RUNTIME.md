# ② 月額返信案の内部実行入口

2026-10-12。買い切りのGAS入口と分離。Webアプリ・月額課金を開始するコマンドではない。

架空データでリクエスト作成→出力検査→確認必須の返信案保存まで実行：
`node --import tsx scripts/monthly_reply.mjs fixture`

実接続の実行入口：
`node --import tsx scripts/monthly_reply.mjs live .local/monthly-input.json`

liveはMONTHLY_AI_ENABLED=true、OPENAI_API_KEY、MONTHLY_AI_MODEL、MONTHLY_MAX_OUTPUT_TOKENSが必要。モデル・API費用は未承認で、初期状態は呼び出し停止。
入力はSquare契約をサーバー側で検証した運用データだけを使う。entitlementSourceの文字列自体は契約検証の証明ではない。Web利用者が書き換えられるJSONから権限を決めない。契約検証・認証を実装するまで外部に公開しない。
実入力・返信は.localのみ、Gitや標準出力へ出さない。入力は匿名化済みに限定。API結果不明・失敗時は勝手に再送しない。store=falseはOpenAIのアプリ状態保存を無効にする設定で、全ログ保持がゼロという意味ではない。

現時点の完了範囲：内部実行入口と架空検証。未実行：有料API通信、認証・Square契約同期、月額決済、Web公開、顧客への提供。
