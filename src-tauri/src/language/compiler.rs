use super::{
    error::LanguageError,
    executor::execution_order,
    graph::{
        BuildSettings,
        FlowProgram,
    },
};
use std::{
    collections::HashMap,
    fs,
    path::Path,
    process::Command,
};

pub fn build_program(
    program: &FlowProgram,
    settings: &BuildSettings,
) -> Result<(), LanguageError> {
    let output = Path::new(&settings.output_path);

    match settings.language.as_str() {
        "rust" => build_rust(
            program,
            output,
            settings.optimize,
            settings.pause_at_end,
        ),
        "tauri-gui" => build_tauri_gui(program, output),
        "javascript" => build_javascript(
            program,
            output,
            settings.pause_at_end,
        ),
        other => Err(LanguageError::Execution {
            node_id: "compiler".to_string(),
            message: format!(
                "未対応の出力言語です: {other}"
            ),
        }),
    }
}

fn build_rust(
    program: &FlowProgram,
    output: &Path,
    optimize: bool,
    pause_at_end: bool,
) -> Result<(), LanguageError> {
    let body = generate_rust(program)?;
    let mut source = String::from(
        "#![allow(non_snake_case)]\n",
    );
    source.push_str(
        "use std::io::{self, Write};\n\n",
    );
    source.push_str("fn read_number(prompt: &str, default_value: f64) -> f64 {\n");
    source.push_str("    print!(\"{} [{}]: \", prompt, default_value);\n");
    source.push_str("    let _ = io::stdout().flush();\n");
    source.push_str("    let mut input = String::new();\n");
    source.push_str("    if io::stdin().read_line(&mut input).is_err() { return default_value; }\n");
    source.push_str("    let trimmed = input.trim();\n");
    source.push_str("    if trimmed.is_empty() { default_value } else { trimmed.parse::<f64>().unwrap_or(default_value) }\n");
    source.push_str("}\n\n");
    source.push_str("fn read_string(prompt: &str, default_value: &str) -> String {\n");
    source.push_str("    print!(\"{} [{}]: \", prompt, default_value);\n");
    source.push_str("    let _ = io::stdout().flush();\n");
    source.push_str("    let mut input = String::new();\n");
    source.push_str("    if io::stdin().read_line(&mut input).is_err() { return default_value.to_string(); }\n");
    source.push_str("    let value = input.trim_end_matches(['\r', '\n']);\n");
    source.push_str("    if value.is_empty() { default_value.to_string() } else { value.to_string() }\n");
    source.push_str("}\n\nfn main() {\n");
    source.push_str(&body);

    if pause_at_end {
        source.push_str(
            "    println!(\"Enterキーで終了します...\");\n",
        );
        source.push_str(
            "    let mut pause = String::new();\n",
        );
        source.push_str(
            "    let _ = io::stdin().read_line(&mut pause);\n",
        );
    }

    source.push_str("}\n");

    let generated_source =
        output.with_file_name(
            "flow_program_generated.rs",
        );

    fs::write(&generated_source, source)
        .map_err(|error| {
            compiler_error(error.to_string())
        })?;

    let mut command = Command::new("rustc");
    command
        .arg("--crate-name")
        .arg("flow_program")
        .arg("--edition")
        .arg("2021");

    if optimize {
        command.arg("-O");
    }

    let result = command
        .arg(&generated_source)
        .arg("-o")
        .arg(output)
        .output()
        .map_err(|error| {
            compiler_error(format!(
                "rustcを起動できません: {error}"
            ))
        })?;

    let _ = fs::remove_file(&generated_source);

    if !result.status.success() {
        return Err(compiler_error(
            String::from_utf8_lossy(
                &result.stderr,
            )
            .into_owned(),
        ));
    }

    Ok(())
}

fn build_javascript(
    program: &FlowProgram,
    output: &Path,
    pause_at_end: bool,
) -> Result<(), LanguageError> {
    let order = execution_order(program)?;
    let nodes: HashMap<&str, _> = program
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let plugins = plugin_nodes(program);
    let mut source = String::from(
        "const readline = require('node:readline/promises');\n",
    );
    source.push_str(
        "const { stdin: input, stdout: output } = require('node:process');\n\n",
    );
    source.push_str("async function main() {\n");
    source.push_str(
        "  const rl = readline.createInterface({ input, output });\n",
    );

    for id in order {
        let node = nodes[id.as_str()];
        let variable = safe_identifier(&node.id);

        match node.node_type.as_str() {
            "core.number" => {
                let value = property_number(
                    node,
                    "value",
                    0.0,
                );
                source.push_str(&format!(
                    "  const {variable}_value = {value};\n"
                ));
            }

            "core.string" => {
                let value = property_string(
                    node,
                    "value",
                    "",
                );
                source.push_str(&format!(
                    "  const {variable}_value = {};\n",
                    js_string(&value),
                ));
            }

            "core.boolean" => {
                let value = node
                    .properties
                    .get("value")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(false);
                source.push_str(&format!(
                    "  const {variable}_value = {value};\n"
                ));
            }

            "core.array" | "core.object" => {
                let fallback = if node.node_type == "core.array" {
                    serde_json::json!([])
                } else {
                    serde_json::json!({})
                };
                let value = node
                    .properties
                    .get("value")
                    .unwrap_or(&fallback);
                source.push_str(&format!(
                    "  const {variable}_value = {};\n",
                    value,
                ));
            }

            "core.input_number" => {
                let prompt = property_string(
                    node,
                    "prompt",
                    "数値を入力してください",
                );
                let default_value = property_number(
                    node,
                    "defaultValue",
                    0.0,
                );
                source.push_str(&format!(
                    "  const {variable}_raw = await rl.question({} + \" [{}]: \");\n",
                    js_string(&prompt),
                    default_value
                ));
                source.push_str(&format!(
                    "  const {variable}_value = {variable}_raw.trim() === '' ? {default_value} : Number({variable}_raw);\n"
                ));
            }

            "core.input_string" => {
                let prompt = property_string(
                    node,
                    "prompt",
                    "文字列を入力してください",
                );
                let default_value = property_string(
                    node,
                    "defaultValue",
                    "",
                );
                source.push_str(&format!(
                    "  const {variable}_raw = await rl.question({} + \" [{}]: \");\n",
                    js_string(&prompt),
                    js_string(&default_value),
                ));
                source.push_str(&format!(
                    "  const {variable}_value = {variable}_raw === '' ? {} : {variable}_raw;\n",
                    js_string(&default_value),
                ));
            }

            "math.add" => {
                let a =
                    input_variable(program, &node.id, "a")?;
                let b =
                    input_variable(program, &node.id, "b")?;
                source.push_str(&format!(
                    "  const {variable}_result = ({a}) + ({b});\n"
                ));
            }


            "gui.label"
            | "gui.button"
            | "gui.input"
            | "gui.row"
            | "gui.column"
            | "gui.window"
            | "gui.show" => {
                return Err(compiler_error(format!(
                    "GUIノード {} はJavaScriptコンソール出力ではなく、出力言語「Tauri GUI EXE」を選択してください",
                    node.node_type,
                )));
            }

            "core.print" => {
                let value = input_variable(
                    program,
                    &node.id,
                    "input",
                )?;
                source.push_str(&format!(
                    "  console.log({value});\n"
                ));
            }

            other => {
                let definition =
                    plugins.get(other).ok_or_else(|| {
                        LanguageError::UnknownNodeType(
                            other.to_string(),
                        )
                    })?;
                let expression =
                    substitute_expression(
                        program,
                        node,
                        definition,
                    )?;
                let output_port =
                    definition.outputs.first().ok_or_else(
                        || {
                            compiler_error(
                                "プラグイン出力がありません"
                                    .to_string(),
                            )
                        },
                    )?;

                source.push_str(&format!(
                    "  const {variable}_{} = ({});\n",
                    safe_identifier(&output_port.id),
                    expression
                ));
            }
        }
    }

    if pause_at_end {
        source.push_str(
            "  await rl.question('Enterキーで終了します...');\n",
        );
    }

    source.push_str("  rl.close();\n}\n\n");
    source.push_str(
        "main().catch((error) => { console.error(error); process.exitCode = 1; });\n",
    );

    fs::write(output, source).map_err(|error| {
        compiler_error(error.to_string())
    })
}

fn generate_rust(
    program: &FlowProgram,
) -> Result<String, LanguageError> {
    let order = execution_order(program)?;
    let nodes: HashMap<&str, _> = program
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let plugins = plugin_nodes(program);
    let mut source = String::new();

    for id in order {
        let node = nodes[id.as_str()];
        let variable = safe_identifier(&node.id);

        match node.node_type.as_str() {
            "core.number" => {
                let value = property_number(
                    node,
                    "value",
                    0.0,
                );
                source.push_str(&format!(
                    "    let {variable}_value: f64 = {value:?};\n"
                ));
            }

            "core.string" => {
                let value = property_string(
                    node,
                    "value",
                    "",
                );
                source.push_str(&format!(
                    "    let {variable}_value: String = {}.to_string();\n",
                    rust_string(&value),
                ));
            }

            "core.boolean" => {
                let value = node
                    .properties
                    .get("value")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(false);
                source.push_str(&format!(
                    "    let {variable}_value: bool = {value};\n"
                ));
            }

            "core.array" | "core.object" => {
                let fallback = if node.node_type == "core.array" {
                    serde_json::json!([])
                } else {
                    serde_json::json!({})
                };
                let value = node
                    .properties
                    .get("value")
                    .unwrap_or(&fallback)
                    .to_string();
                source.push_str(&format!(
                    "    let {variable}_value: String = {}.to_string();\n",
                    rust_string(&value),
                ));
            }

            "core.input_number" => {
                let prompt = property_string(
                    node,
                    "prompt",
                    "数値を入力してください",
                );
                let default_value = property_number(
                    node,
                    "defaultValue",
                    0.0,
                );
                source.push_str(&format!(
                    "    let {variable}_value: f64 = read_number({}, {default_value:?});\n",
                    rust_string(&prompt)
                ));
            }

            "core.input_string" => {
                let prompt = property_string(
                    node,
                    "prompt",
                    "文字列を入力してください",
                );
                let default_value = property_string(
                    node,
                    "defaultValue",
                    "",
                );
                source.push_str(&format!(
                    "    let {variable}_value: String = read_string({}, {});\n",
                    rust_string(&prompt),
                    rust_string(&default_value),
                ));
            }

            "math.add" => {
                let a =
                    input_variable(program, &node.id, "a")?;
                let b =
                    input_variable(program, &node.id, "b")?;
                source.push_str(&format!(
                    "    let {variable}_result: f64 = ({a}) + ({b});\n"
                ));
            }


            "gui.label"
            | "gui.button"
            | "gui.input"
            | "gui.row"
            | "gui.column"
            | "gui.window"
            | "gui.show" => {
                return Err(compiler_error(format!(
                    "GUIノード {} はRustコンソールEXEではなく、出力言語「Tauri GUI EXE」を選択してください",
                    node.node_type,
                )));
            }

            "core.print" => {
                let value = input_variable(
                    program,
                    &node.id,
                    "input",
                )?;
                source.push_str(&format!(
                    "    println!(\"{{}}\", {value});\n"
                ));
            }

            other => {
                let definition =
                    plugins.get(other).ok_or_else(|| {
                        LanguageError::UnknownNodeType(
                            other.to_string(),
                        )
                    })?;
                let expression =
                    substitute_expression(
                        program,
                        node,
                        definition,
                    )?;
                let output_port =
                    definition.outputs.first().ok_or_else(
                        || {
                            compiler_error(
                                "プラグイン出力がありません"
                                    .to_string(),
                            )
                        },
                    )?;

                source.push_str(&format!(
                    "    let {variable}_{}: f64 = ({});\n",
                    safe_identifier(&output_port.id),
                    expression
                ));
            }
        }
    }

    Ok(source)
}

fn plugin_nodes(
    program: &FlowProgram,
) -> HashMap<
    &str,
    &super::graph::PluginNodeDefinition,
> {
    program
        .plugins
        .iter()
        .flat_map(|plugin| plugin.nodes.iter())
        .map(|node| {
            (node.language_type.as_str(), node)
        })
        .collect()
}

fn substitute_expression(
    program: &FlowProgram,
    node: &super::graph::ProgramNode,
    definition: &super::graph::PluginNodeDefinition,
) -> Result<String, LanguageError> {
    let mut expression =
        definition.expression.clone().ok_or_else(|| compiler_error("このプラグインノードはJavaScriptランタイム専用で、書き出しに対応していません".to_string()))?;

    for port in &definition.inputs {
        let replacement = input_variable(
            program,
            &node.id,
            &port.id,
        )?;

        expression = replace_identifier(
            &expression,
            &port.id,
            &format!("({replacement})"),
        );
    }

    Ok(expression)
}

fn input_variable(
    program: &FlowProgram,
    node: &str,
    port: &str,
) -> Result<String, LanguageError> {
    let connection = program
        .connections
        .iter()
        .find(|connection| {
            connection.target_node == node
                && connection.target_port == port
        })
        .ok_or_else(|| {
            LanguageError::MissingInput {
                node_id: node.to_string(),
                port: port.to_string(),
            }
        })?;

    Ok(format!(
        "{}_{}",
        safe_identifier(&connection.source_node),
        safe_identifier(&connection.source_port)
    ))
}

fn property_number(
    node: &super::graph::ProgramNode,
    key: &str,
    default_value: f64,
) -> f64 {
    node.properties
        .get(key)
        .and_then(|value| value.as_f64())
        .unwrap_or(default_value)
}

fn property_string(
    node: &super::graph::ProgramNode,
    key: &str,
    default_value: &str,
) -> String {
    node.properties
        .get(key)
        .and_then(|value| value.as_str())
        .unwrap_or(default_value)
        .to_string()
}

fn safe_identifier(value: &str) -> String {
    let mut identifier: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '_'
            {
                character
            } else {
                '_'
            }
        })
        .collect();

    if identifier.is_empty() {
        identifier.push_str("node");
    }

    if identifier
        .chars()
        .next()
        .is_some_and(|character| {
            character.is_ascii_digit()
        })
    {
        identifier.insert_str(0, "n_");
    }

    identifier
}

fn replace_identifier(
    expression: &str,
    identifier: &str,
    replacement: &str,
) -> String {
    let mut output = String::new();
    let mut token = String::new();

    let flush =
        |token: &mut String, output: &mut String| {
            if token == identifier {
                output.push_str(replacement);
            } else {
                output.push_str(token);
            }

            token.clear();
        };

    for character in expression.chars() {
        if character.is_ascii_alphanumeric()
            || character == '_'
        {
            token.push(character);
        } else {
            flush(&mut token, &mut output);
            output.push(character);
        }
    }

    flush(&mut token, &mut output);
    output
}

fn rust_string(value: &str) -> String {
    format!("{value:?}")
}

fn js_string(value: &str) -> String {
    serde_json::to_string(value)
        .unwrap_or_else(|_| "\"\"".to_string())
}

fn compiler_error(message: String) -> LanguageError {
    LanguageError::Execution {
        node_id: "compiler".to_string(),
        message,
    }
}


fn build_tauri_gui(
    program: &FlowProgram,
    output: &Path,
) -> Result<(), LanguageError> {
    use std::time::{
        SystemTime,
        UNIX_EPOCH,
    };

    let timestamp =
        SystemTime::now()
            .duration_since(
                UNIX_EPOCH,
            )
            .map(|value| {
                value.as_millis()
            })
            .unwrap_or_default();

    let workspace =
        std::env::temp_dir()
            .join(format!(
                "flow-language-export-{}-{}",
                std::process::id(),
                timestamp,
            ));

    let target_cache =
        std::env::temp_dir()
            .join(
                "flow-language-export-cache",
            )
            .join("target");

    fs::create_dir_all(
        workspace.join("src"),
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    fs::create_dir_all(
        &target_cache,
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    let program_json =
        serde_json::to_string(
            program,
        )
        .map_err(|error| {
            compiler_error(
                error.to_string(),
            )
        })?;

    let html =
        standalone_html(
            &program_json,
        );

    fs::write(
        workspace.join(
            "index.html",
        ),
        html,
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    fs::write(
        workspace.join(
            "Cargo.toml",
        ),
        r#"[package]
name = "flow_export"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde_json = "1"
"#,
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    fs::write(
        workspace.join(
            "build.rs",
        ),
        "fn main() { tauri_build::build() }\n",
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    fs::write(
        workspace.join(
            "src/main.rs",
        ),
        r#"fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run generated app");
}
"#,
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    fs::write(
        workspace.join(
            "tauri.conf.json",
        ),
        r#"{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Flow Export",
  "version": "0.1.0",
  "identifier": "com.flowlanguage.export",
  "build": {
    "frontendDist": "."
  },
  "app": {
    "windows": [
      {
        "title": "Flow Export",
        "width": 900,
        "height": 650,
        "devtools": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": false
  }
}"#,
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    let mut command =
        Command::new("cargo");

    command
        .arg("build")
        .arg("--release")
        .current_dir(
            &workspace,
        )
        .env(
            "CARGO_TARGET_DIR",
            &target_cache,
        );

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        command.creation_flags(
            0x08000000,
        );
    }

    let result =
        command
            .output()
            .map_err(|error| {
                compiler_error(
                    format!(
                        "生成Tauriアプリのcargo buildを起動できません: {}",
                        error,
                    ),
                )
            })?;

    if !result.status.success() {
        let _ =
            fs::remove_dir_all(
                &workspace,
            );

        return Err(
            compiler_error(
                String::from_utf8_lossy(
                    &result.stderr,
                )
                .into_owned(),
            ),
        );
    }

    let built =
        target_cache
            .join("release")
            .join(
                if cfg!(windows) {
                    "flow_export.exe"
                } else {
                    "flow_export"
                },
            );

    fs::copy(
        &built,
        output,
    )
    .map_err(|error| {
        compiler_error(
            error.to_string(),
        )
    })?;

    let _ =
        fs::remove_dir_all(
            &workspace,
        );

    Ok(())
}

fn standalone_html(program_json: &str) -> String {
    let escaped = program_json.replace("</script>", "<\\/script>");

    format!(
        r#"<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flow Export</title>
<style>
body{{font-family:system-ui;margin:0;background:#111827;color:#f3f4f6}}
#log{{white-space:pre-wrap;padding:16px}}
.plugin-window{{position:relative;margin:20px;border:1px solid #64748b;border-radius:10px;background:#1f2937;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.35)}}
.plugin-window header{{display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid #64748b;font-weight:700}}
.plugin-window header button{{border:0;background:transparent;color:#f3f4f6;font-size:20px;cursor:pointer}}
.plugin-window main{{display:flex;flex-direction:column;gap:10px;padding:18px}}
.flow-row,.flow-column{{display:flex;gap:10px;align-items:center}}
.flow-column{{flex-direction:column;align-items:stretch}}
.plugin-window input,.plugin-window button{{border:1px solid #64748b;border-radius:7px;background:#111827;color:#f3f4f6;padding:9px}}
</style>
</head>
<body>
<div id="log">Flow program started...</div>
<script>
const program = {escaped};
const log = (value) => {{
  document.querySelector('#log').textContent += '\\n' + String(value);
}};
const values = new Map();
const byId = new Map(program.nodes.map(n => [n.id, n]));
const indegree = new Map(program.nodes.map(n => [n.id, 0]));
const outgoing = new Map();
for (const e of program.connections) {{
  indegree.set(e.targetNode, (indegree.get(e.targetNode)||0)+1);
  outgoing.set(e.sourceNode, [...(outgoing.get(e.sourceNode)||[]), e.targetNode]);
}}
const ready = program.nodes.filter(n => indegree.get(n.id)===0);
const order = [];
while (ready.length) {{
  const n = ready.shift();
  order.push(n);
  for (const t of outgoing.get(n.id)||[]) {{
    indegree.set(t, indegree.get(t)-1);
    if (indegree.get(t)===0) ready.push(byId.get(t));
  }}
}}
const pluginDefs = new Map();
for (const p of program.plugins||[]) {{
  if (p.enabled === false) continue;
  for (const n of p.nodes||[]) pluginDefs.set(n.languageType, n);
}}
function inputsFor(id) {{
  const result = {{}};
  for (const e of program.connections) {{
    if (e.targetNode===id) result[e.targetPort]=values.get(e.sourceNode+':'+e.sourcePort);
  }}
  return result;
}}
function renderGuiComponent(spec) {{
  if (!spec || typeof spec !== 'object') {{
    const span=document.createElement('span');
    span.textContent=String(spec??'');
    return span;
  }}

  switch(spec.kind) {{
    case 'label': {{
      const span=document.createElement('span');
      span.textContent=String(spec.text??'');
      return span;
    }}

    case 'button': {{
      const button=document.createElement('button');
      const label=String(spec.text??'Button');
      let count=0;
      button.textContent=label;
      button.addEventListener('click',()=>{{
        count+=1;
        button.textContent=label+' ('+count+')';
      }});
      return button;
    }}

    case 'input': {{
      const input=document.createElement('input');
      input.type='text';
      input.placeholder=String(spec.text??'');
      input.value=String(spec.value??'');
      return input;
    }}

    case 'row':
    case 'column': {{
      const container=document.createElement('div');
      container.className=spec.kind==='row'?'flow-row':'flow-column';
      for (const child of spec.children||[]) {{
        container.appendChild(renderGuiComponent(child));
      }}
      return container;
    }}

    default: {{
      const span=document.createElement('span');
      span.textContent=JSON.stringify(spec);
      return span;
    }}
  }}
}}

function showGuiWindow(spec) {{
  if (!spec || spec.kind!=='window') {{
    throw new Error('Show GUI requires GUI Window specification');
  }}

  const section=document.createElement('section');
  section.className='plugin-window';
  section.style.width=Math.max(240,Number(spec.width??480))+'px';
  section.style.minHeight=Math.max(120,Number(spec.height??240))+'px';

  const header=document.createElement('header');
  const title=document.createElement('span');
  title.textContent=String(spec.title??'Flow GUI');

  const close=document.createElement('button');
  close.textContent='×';
  close.addEventListener('click',()=>section.remove());

  header.append(title,close);

  const main=document.createElement('main');
  for (const child of spec.children||[]) {{
    main.appendChild(renderGuiComponent(child));
  }}

  section.append(header,main);
  document.body.append(section);
  return crypto.randomUUID();
}}

const api = {{
  log,
  createWindow(o) {{
    return showGuiWindow({{
      kind:'window',
      title:o.title||'Window',
      children:[{{
        kind:'label',
        text:String(o.content??'')
      }}]
    }});
  }}
}};
(async()=>{{
for (const n of order) {{
  const i=inputsFor(n.id), p=n.properties||{{}}, out={{}};
  switch(n.nodeType) {{
    case 'core.number': out.value=p.value??0; break;
    case 'core.string': out.value=p.value??''; break;
    case 'core.boolean': out.value=Boolean(p.value??false); break;
    case 'core.array': out.value=Array.isArray(p.value)?structuredClone(p.value):[]; break;
    case 'core.object': out.value=p.value&&typeof p.value==='object'&&!Array.isArray(p.value)?structuredClone(p.value):{{}}; break;
    case 'math.add': out.result=Number(i.a)+Number(i.b); break;
    case 'string.concat': out.result=String(i.a??'')+String(i.b??''); break;
    case 'logic.if': out.result=i.condition?i.whenTrue:i.whenFalse; break;

    case 'gui.label':
      out.component={{id:n.id,kind:'label',text:String(i.text??'')}};
      break;

    case 'gui.button':
      out.component={{id:n.id,kind:'button',text:String(i.text??'Button')}};
      break;

    case 'gui.input':
      out.component={{
        id:n.id,
        kind:'input',
        text:String(i.placeholder??''),
        value:String(i.value??'')
      }};
      break;

    case 'gui.row':
    case 'gui.column':
      out.component={{
        id:n.id,
        kind:n.nodeType==='gui.row'?'row':'column',
        children:Array.isArray(i.children)?i.children:[]
      }};
      break;

    case 'gui.window':
      out.window={{
        id:n.id,
        kind:'window',
        title:String(i.title??'Flow GUI'),
        width:Number(i.width??480),
        height:Number(i.height??240),
        children:Array.isArray(i.content)
          ? i.content
          : i.content
            ? [i.content]
            : []
      }};
      break;

    case 'gui.show':
      out.windowId=showGuiWindow(i.window);
      break;
    case 'core.print': log(i.input); break;
    default: {{
      const d=pluginDefs.get(n.nodeType);
      if (!d) throw new Error('Unknown node: '+n.nodeType);
      if (d.runtime?.kind==='javascript') {{
        const AsyncFunction=Object.getPrototypeOf(async function(){{}}).constructor;
        const fn=new AsyncFunction('inputs','properties','modules','api',d.runtime.handler||'');
        Object.assign(out, await fn(i,p,{{}},api) || {{}});
      }} else if (d.expression) {{
        const names=Object.keys(i);
        const fn=new Function(...names,'return ('+d.expression+')');
        out[d.outputs[0].id]=fn(...Object.values(i));
      }}
    }}
  }}
  for (const [k,v] of Object.entries(out)) values.set(n.id+':'+k,v);
}}
}})().catch(e=>log('ERROR: '+e));
</script>
</body>
</html>"#
    )
}
