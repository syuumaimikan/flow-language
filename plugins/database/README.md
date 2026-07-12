# Database adapter plugins

SQLiteはFlow Language本体に組み込まれています。

PostgreSQLとMySQLは外部プロセスABIの前提プラグインとして提供しています。

```text
postgresql-load.json
mysql-load.json
postgresql_adapter.rs
mysql_adapter.cpp
```

サンプルアダプターは接続を実行せず、受信JSONの確認だけを行います。実用版では次のライブラリなどを組み込んでください。

```text
Rust PostgreSQL: postgres / tokio-postgres / sqlx
C++ MySQL: MySQL Connector/C++
```

外部アダプターは標準入力から次を受け取ります。

```json
{
  "inputs": {
    "connection": {},
    "sql": "SELECT ...",
    "params": []
  },
  "properties": {}
}
```

標準出力はJSONオブジェクトにします。

```json
{
  "rows": []
}
```
