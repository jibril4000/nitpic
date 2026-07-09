<p align="center">
  <img src="../assets/cover.png" alt="nitpic" width="640" />
</p>

<h3 align="center">気になる箇所をクリック。直してほしいことを書く。あとは Claude が直します。</h3>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-91C31C?style=flat-square" alt="MIT ライセンス" /></a>
  <img src="https://img.shields.io/badge/Chrome%20Web%20Store-%E8%BF%91%E6%97%A5%E5%85%AC%E9%96%8B-FF8C00?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store" />
  <img src="https://img.shields.io/badge/Claude%20Code-%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3-91C31C?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code プラグイン" />
  <a href="https://buymeacoffee.com/jibrilai"><img src="https://img.shields.io/badge/%E2%98%95-%E3%82%B3%E3%83%BC%E3%83%92%E3%83%BC%E3%82%92%E3%81%94%E3%81%A1%E3%81%9D%E3%81%86%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84-FFDD00?style=flat-square" alt="コーヒーをごちそうする" /></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

**nitpic** はブラウザと [Claude Code](https://claude.com/claude-code) をつなぎます。フィードバックモードをオンにして、どのページでも — `localhost` でも本番でも — 任意の要素をクリックし、直してほしい内容を書いて送信するだけ。コメント、切り抜きスクリーンショット、要素の HTML が、実行中の Claude Code セッションに**まるでそこで入力したかのように**届き、Claude が作業を始めます。

ブラウザでアプリを確認し、ターミナルで直す — そんなデザイナー、開発者、Vibe Coder のためのツールです。

## ✨ 特長

- **🎯 問題を指差す** — ホバーで要素をハイライト、ドラッグで領域選択。CSS セレクタ・スクリーンショット・HTML は nitpic が自動取得
- **⚡ 即時配信** — フィードバックは 1 秒以内にターミナルへ（tmux と iTerm2 は本物のキーストローク注入。それ以外は Claude の次のターンで届きます）
- **🎛 セッションは自分で選ぶ** — 受け取りたい Claude Code セッションで `/nitpic` と入力。別のセッションで実行すれば接続が移動します
- **📚 まとめてレビュー** — 複数のページやタブでコメントを集めて、ページごとにグループ化された 1 通のメッセージとして送信
- **🫧 フローティングパネル** — ドラッグ移動・ピル型に折りたたみ可能。ビューポートを狭めず、レスポンシブのブレークポイントも発火させません
- **🔒 完全ローカル** — アカウント不要、サーバーなし、テレメトリなし。すべてあなたのマシン内で完結
- **🪄 摩擦ゼロのセットアップ** — ペアリングは全自動。コードのコピーも設定ファイルの編集も不要

## 🚀 クイックスタート

**1. Chrome 拡張機能をインストール** — *（Web ストアのリンクは近日公開。それまでは `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」 → `extension/dist`）*

**2. Claude Code プラグインをインストール** — 任意のセッションに貼り付け:

```
/plugin marketplace add jibril4000/nitpic
/plugin install nitpic@nitpic
```

**3. 接続** — フィードバックを受け取るセッションで:

```
/nitpic
```

**4. あら探し開始** — レビュー中のページで nitpic アイコンをクリック → **Start feedback** → 要素をクリック → コメントを書いて **Send**。これがすべてです。

## 🧠 仕組み

| ターミナル | 配信 |
| --- | --- |
| tmux | ⚡ 即時 — 対象ペインに直接注入 |
| iTerm2 | ⚡ 即時 — セッション API 経由で注入 |
| その他 | ⏭ ターン境界で — Claude が現在の応答を終えたときに届き、デスクトップ通知でお知らせ |

スクリーンショットと HTML 断片は `<プロジェクト>/.feedback/` に保存されます（自動で `.gitignore` に追加）。受信セッションがない場合はディスク上のキューに入り、接続され次第配信されます。

## 🔒 プライバシーとセキュリティ

すべてローカルです。スイッチボードは `127.0.0.1` のみで待ち受け、（自動交換される）ペアリングトークンにより任意の Web ページからのなりすましを防ぎます。拡張機能はデータを一切収集しません。

## 🗺 ロードマップ

- [x] Claude Code
- [ ] Cursor
- [ ] Codex
- [ ] Gemini CLI
- [ ] VS Code ターミナルへの注入
- [ ] デバイスサイズプレビュー
- [ ] Chrome Web Store + トークン不要ペアリング

## ☕ 応援する

nitpic が往復作業を減らしてくれたら、[コーヒーをごちそうしてください](https://buymeacoffee.com/jibrilai)。作者: [Jibril](https://linkedin.com/in/jibril-ai)

## 📝 ライセンス

[MIT](../LICENSE)
