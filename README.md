# PRIVATE ARCHIVE / ATELIER 04

GitHub Pages + Supabaseで動く、iPhone・Mac向けの画像保管アプリ。
ChatGPT SitesのサーバーやChatGPT契約に依存しない静的JavaScript版。

**2026-10-21：実装・接続設定中。実アカウントの端末間同期とiPhone実機検証は未完了。本番運用前の版です。**

## 機能

- JPEG/PNG/WebP原本の追加、フォルダー、複数選択・移動、お気に入り、ごみ箱と復元。
- JPEG/PNG/原本で書き出し。JPEG/PNGには今日または登録した元の日付を付与。
- 原本は変換しないため、原本出力の内部日付は変更しない。
- 最大30枚のZIP書き出し、JSONバックアップ。
- Googleログイン、Supabaseの非公開Storage、利用者別IndexedDB。
- ページを開いている間に自動同期。同時編集は別バージョンを保持。

## 設定・公開

1. 新規Supabaseで `001_private_archive.sql` を1回適用する。既存アプリのプロジェクトに流用しない。
2. Google OAuthを設定。Google側の承認済みリダイレクトURIはSupabaseの `/auth/v1/callback`。
3. SupabaseのSite URLとRedirect URLsに公開アプリの正確な `https://atelier04studio-dot.github.io/private-archive/index.html` を登録する。ワイルドカードを使わない。
4. `config.js` にはプロジェクトURLと **publishable keyのみ**を置く。service role、secret key、DBパスワード、OAuth secretは禁止。
5. 本人が一度ログインしたあと、Supabase Usersの本人UUIDを管理者が確認し、SQL Editorから `insert into public.pa_members(user_id) values ('確認済みの本人UUID');` を実行する。誰でも自分を会員登録できるAPIはない。
6. GitHub PagesのSourceを `Deploy from a branch`、`main`、`/(root)` にする。画像そのものをGitHubにアップロードしない。
7. 一般ユーザーA/Bと匿名で直接APIのアクセス拒否を検証し、iPhone/Mac同期、再読込、Google OAuth復帰、書き出し後の写真アプリを確認する。

新Supabase：`ebzcuotuvvqtealoqzax`。2026-10-21にschemaを適用済み。
`002_policy_checks.sql` は一時データによるDBロールテスト。すべてロールバックする。実JWTとStorage APIの検証の代わりにはならない。

## 開発・テスト

ビルド不要。HTTPSまたはlocalhostから配信する。`file://`で開かない。

```sh
python3 -m http.server 4173 --bind 127.0.0.1
npm test
```

Supabase JS SDK 2.117.3は `supabase-vendor.js` に同梱。esbuild 0.27.3で `@supabase/supabase-js/dist/index.mjs` をbrowser/ESM/minifyとしてbundleした。ライセンスは `THIRD_PARTY_LICENSES.txt`。CDN実行依存なし。

## 制限と運用

- 1枚30MiB、画像は合計300MiB（ごみ箱含む）。画像内メタデータと申告サイズをDBでも検査する。
- 300MiBはmanifestの制限。中断アップロード等の孤立原本を含めたStorage全体の厳密な利用者別上限は未実装。招待制で運用し、Supabase Usageを確認する。
- 新しい端末の初回同期では全原本を取得。各端末のキャッシュ済み原本は再取得しない。サムネイル専用クラウド取得は未実装。
- 端末やブラウザの空き容量が必要。ログアウトしても本人専用キャッシュは残る。共有端末には使わない。ローカル消去画面は未実装。
- ごみ箱は復元可能な論理削除。永久削除と孤立ファイル清掃は未実装。
- 完全オフライン起動、HEIC/GIF、PNG日付の全写真アプリ互換は保証しない。
- クラウド障害や無料枠休止に備え、バックアップと元の写真を保持する。
- 友人・家族の追加は容量・アクセス拒否テスト完了後に管理者が許可する。

Supabase無料枠はStorage 1GB、DB 500MB、転送量5GB等。最新条件は [Supabase pricing](https://supabase.com/pricing) を確認する。
[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) も確認する。商用SaaSの公開基盤としての利用は別途検討が必要。

ブランド素材・コードの権利を自動的にオープンソースライセンスで許諾するものではありません。第三者ライブラリは各ライセンスに従います。
