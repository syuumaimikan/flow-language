# External-process plugin ABI

Flow Languageは外部プロセスへJSONをstdinで送り、stdoutからJSONを受け取れます。

入力:

```json
{
  "inputs": {
    "payload": {}
  },
  "properties": {}
}
```

出力:

```json
{
  "result": {}
}
```

## ビルド例

Rust:

```powershell
rustc .\plugins\loaders\rust_test.rs -O -o .\plugins\loaders\rust_test.exe
```

C (MSVC Developer Command Prompt):

```powershell
cl /O2 /Fe:plugins\loaders\c_test.exe plugins\loaders\c_test.c
```

C++:

```powershell
cl /EHsc /O2 /Fe:plugins\loaders\cpp_test.exe plugins\loaders\cpp_test.cpp
```

Lua:

Lua実行環境をPATHへ追加してください。実用プラグインではLua用JSONライブラリを使用してください。

> 外部プロセスプラグインは任意コードを実行します。信頼できるプラグインだけを有効にしてください。
