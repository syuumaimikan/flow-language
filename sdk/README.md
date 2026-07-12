# Flow Language Plugin SDK v1

Phase 4ではプラグインSDKを次の2方式に統一します。

## JavaScript Runtime ABI

manifestの`runtime.kind`を`javascript`にします。

```json
{
  "runtime": {
    "kind": "javascript",
    "handler": "return { result: inputs.value };"
  }
}
```

ハンドラー引数:

```text
inputs
properties
modules
api
```

戻り値は出力ポートIDをキーとしたJSON互換オブジェクトです。

## External Process ABI

Lua、Rust、C、C++、Python、C#、Javaなどは共通JSON stdin/stdout ABIを使用できます。

標準入力:

```json
{
  "inputs": {},
  "properties": {}
}
```

標準出力:

```json
{
  "result": {}
}
```

エラー時:

```text
標準エラーへ説明
0以外の終了コード
```

## manifest必須項目

```json
{
  "id": "com.example.plugin",
  "name": "Example",
  "version": "1.0.0",
  "enabled": true,
  "nodes": []
}
```

各ノード:

```json
{
  "languageType": "com.example.node",
  "title": "Example Node",
  "category": "Plugin/Example",
  "description": "説明",
  "inputs": [],
  "outputs": [],
  "defaultProperties": {},
  "runtime": {}
}
```

## セキュリティ

プラグインは任意コードを実行できます。署名、権限manifest、サンドボックスは今後の拡張点です。信頼できるパッケージだけをインストールしてください。
