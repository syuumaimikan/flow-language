# Flow Language

> **Flow Language** は、**Tauri + React Flow + Rust**
> を用いた、拡張性を重視したノードベースプログラミング環境です。

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Rust](https://img.shields.io/badge/backend-Rust-orange)
![React](https://img.shields.io/badge/frontend-React-61DAFB)
![Tauri](https://img.shields.io/badge/framework-Tauri-24C8DB)

------------------------------------------------------------------------

# 特徴

-   ノードベースプログラミング
-   Tauriによるデスクトップアプリ
-   React Flowベースの高速エディタ
-   Rust実行エンジン
-   プロジェクト保存（`.flsc`）
-   EXE生成
-   プラグインシステム
-   GUIノード
-   デバッガ
-   プロファイラ
-   ブレークポイント
-   並列実行
-   ライト/ダークテーマ
-   グループ化
-   コピー・貼り付け
-   Ctrl+D複製
-   D&D追加
-   ノード検索

------------------------------------------------------------------------

# 基本ノード

-   数値
-   文字列
-   Boolean
-   Array
-   Object
-   Print
-   Input
-   IF
-   While
-   Switch
-   Function
-   Lambda
-   Map
-   Filter
-   Reduce
-   Iterator
-   JSON
-   XML
-   HTTP
-   SQLite
-   ORM
-   Cache
-   SHA-256
-   AES
-   GUI
-   GPU
-   Option
-   Union

------------------------------------------------------------------------

# プラグイン

Flow Languageはプラグインで機能を追加できます。

対応予定・対応言語

-   Rust
-   JavaScript
-   Lua
-   Python
-   C
-   C++
-   C#
-   Java

プラグインでは

-   ノード追加
-   GUI追加
-   音声入力
-   FFT
-   通信
-   WebAPI
-   データベース
-   独自ランタイム

などを実装できます。

------------------------------------------------------------------------

# ディレクトリ

``` text
src/
    React UI

src-tauri/
    Rust Backend

plugins/
    Plugin

examples/
    Sample Projects

sdk/
    Plugin SDK
```

------------------------------------------------------------------------

# ビルド

## 必要環境

-   Rust Stable
-   Node.js 20+
-   npm
-   Visual Studio Build Tools（Windows）

## 開発

``` bash
npm install
npm run tauri dev
```

## リリース

``` bash
npm run tauri build
```

------------------------------------------------------------------------

# サンプル

`examples/` に多数の `.flsc` サンプルが含まれています。

例

-   GUI
-   HTTP
-   SQLite
-   Array
-   Object
-   Map
-   Filter
-   Reduce
-   暗号化
-   JSON
-   XML

------------------------------------------------------------------------

# 今後の予定

-   LLVMバックエンド
-   WebAssemblyバックエンド
-   Linux対応
-   macOS対応
-   Marketplace
-   オンラインプラグイン配布
-   AIノード
-   GPUアクセラレーション強化
-   ビジュアルGUIデザイナー拡張

------------------------------------------------------------------------

# ライセンス

MIT License

------------------------------------------------------------------------

# スクリーンショット

スクリーンショットは `docs/images/` に配置してください。

``` text
docs/images/editor.png
docs/images/gui.png
docs/images/debugger.png
```

------------------------------------------------------------------------

# 作者

GitHub: **syuumaimikan**
