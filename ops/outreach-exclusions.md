# Outreach Exclusions — sales-prohibited / unsuitable contact channels

Check this file before any cold outreach, in addition to the Excel gray exclusion list.

## Explicit sales prohibition
- 民泊.hub in 九州 — official contact page states that sales-purpose contacts are not accepted. Do not email or submit sales proposals to info@minpaku-hub.com or its contact forms.

## 2026-10-29 確認済み不達（民泊AI実務キット運営Gmail）
- `info@gainshaft.com` — Gmail DSN: `550 5.1.1 Recipient address rejected: User unknown in relay recipient table`。送信キューから除外し、再送しない。別の公開窓口を確認できた場合も法人単位の過去送信・禁止先判定を先に行う。

## Rule
If an official page states sales solicitation is not accepted, or the channel is guest-only/reservation-only/support-only, exclude the lead even if the company is otherwise a strong product fit.

## 2026-11-01 Gmail DSN・配信停止の最新照合
- ①②の運営Gmailで配信停止を明示した **株式会社Peony** と **楽々プランニング株式会社** は会社単位で営業禁止。別アドレス・問い合わせフォームへの迂回送信も禁止。
- 直近Gmail DSNから判明した不達・ブロック・一時保留の宛先は、運営者限定の Google Drive「①② GuestOps AI｜営業停止・不達・保留マスター 20261101（内部限定）」で管理。公開Gitリポジトリへ個人宛先・停止返信全文を転記しない。
- 送信前にこの内部台帳を読み、**HARD_BOUNCE** は宛先再送禁止、**HOLD** は解消が確認できるまで再送禁止、**STOP** は法人単位の連絡禁止。さらに Gmail 全期間の会社単位の送信済み判定を行う。DSNだけを確認して送信可能と判定してはならない。
- 今回のDSN検索は直近30日と停止返信の照合であり、Gmail全期間の重複排除完了を意味しない。
