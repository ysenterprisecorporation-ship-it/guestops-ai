# Gray / Do-not-contact exclusions — source of truth

Source: `やることリスト20260922_企業リスト拡張_送信準備_20261013.xlsx`, sheet `リスト`.
Rule: rows whose A/B lead cells use the gray fill are **out of scope**, even when column K says 「可能」.
This list must be checked before Gmail dedupe, lead scoring, drafting, or outreach.

## Excluded companies
- Concier Desk（コンシェルジュデスク）
- 民泊管理バンク
- OCiETe（オシエテ）
- 株式会社プレイズ
- PIPI Hosting
- 株式会社KIND
- 株式会社Zens
- OHAco（オハコ）
- GURASS
- 株式会社ReINN
- 株式会社M’s-support（エムズサポート）
- ゆめゆめ株式会社
- 楽々プランニング株式会社
- AI民泊代行
- 株式会社リクリエ
- J-stay
- 株式会社IKIDANE
- TOMARU株式会社
- 株式会社SHINOBI
- 株式会社羅針盤
- リソル不動産株式会社
- 株式会社PQD
- 株式会社MATATABI
- 株式会社グローバルキャスト
- TATERU bnb

## Enforcement order
1. Exclude all companies in this file.
2. Exclude existing personal relationships unless explicitly handled as relationship outreach.
3. Company/domain/person/channel/date-time dedupe against Gmail and other channels.
4. Only then score fit and create a draft.
5. Never infer eligibility from the word 「可能」 alone; workbook cell color overrides it.
