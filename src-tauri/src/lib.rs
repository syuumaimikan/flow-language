mod language;

use language::{
    build_program as compile_program,
    execute,
    BuildResult,
    BuildSettings,
    ExecuteResult,
    FlowProgram,
};

use std::{
    fs,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};

#[tauri::command]
fn execute_program(
    program: FlowProgram,
) -> ExecuteResult {
    match execute(program) {
        Ok(logs) => ExecuteResult {
            success: true,
            logs,
            error: None,
        },

        Err(error) => ExecuteResult {
            success: false,
            logs: Vec::new(),
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
fn build_program(
    program: FlowProgram,
    settings: BuildSettings,
) -> BuildResult {
    let output_path = settings.output_path.clone();

    match compile_program(&program, &settings) {
        Ok(()) => BuildResult {
            success: true,
            output_path: Some(output_path),
            error: None,
        },

        Err(error) => BuildResult {
            success: false,
            output_path: None,
            error: Some(error.to_string()),
        },
    }
}

fn collect_plugin_manifests(
    directory: &std::path::Path,
    loaded: &mut std::collections::HashSet<PathBuf>,
    manifests: &mut Vec<String>,
) -> Result<(), String> {
    if !directory.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(directory)
        .map_err(|error| {
            format!(
                "{}を読めません: {}",
                directory.display(),
                error,
            )
        })?
    {
        let path = entry
            .map_err(|error| {
                error.to_string()
            })?
            .path();

        if path.is_dir() {
            collect_plugin_manifests(
                &path,
                loaded,
                manifests,
            )?;

            continue;
        }

        let is_json = path
            .extension()
            .and_then(|extension| {
                extension.to_str()
            })
            .is_some_and(|extension| {
                extension.eq_ignore_ascii_case(
                    "json",
                )
            });

        if !is_json {
            continue;
        }

        let normalized_path = path
            .canonicalize()
            .unwrap_or_else(|_| {
                path.clone()
            });

        if !loaded.insert(
            normalized_path,
        ) {
            continue;
        }

        let contents =
            fs::read_to_string(&path)
                .map_err(|error| {
                    format!(
                        "{}を読めません: {}",
                        path.display(),
                        error,
                    )
                })?;

        serde_json::from_str::<
            serde_json::Value,
        >(&contents)
        .map_err(|error| {
            format!(
                "{}のJSONが不正です: {}",
                path.display(),
                error,
            )
        })?;

        manifests.push(contents);
    }

    Ok(())
}

#[tauri::command]
fn load_installed_plugins(
    app: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    use tauri::Manager;

    let mut directories = Vec::<PathBuf>::new();

    if let Ok(current) = std::env::current_dir() {
        directories.push(current.join("plugins"));

        if let Some(parent) = current.parent() {
            directories.push(parent.join("plugins"));
        }
    }

    if let Ok(app_data) = app.path().app_data_dir() {
        directories.push(app_data.join("plugins"));
    }

    if let Ok(resource) = app.path().resource_dir() {
        directories.push(resource.join("plugins"));
        directories.push(
            resource
                .join("_up_")
                .join("plugins"),
        );
    }

    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            directories.push(parent.join("plugins"));
        }
    }

    let mut searched =
        std::collections::HashSet::<PathBuf>::new();
    let mut loaded =
        std::collections::HashSet::<PathBuf>::new();
    let mut manifests = Vec::<String>::new();

    for directory in directories {
        let normalized_directory = directory
            .canonicalize()
            .unwrap_or_else(|_| {
                directory.clone()
            });

        if !searched.insert(
            normalized_directory,
        ) {
            continue;
        }

        collect_plugin_manifests(
            &directory,
            &mut loaded,
            &mut manifests,
        )?;
    }

    Ok(manifests)
}

#[tauri::command]
fn execute_external_plugin(
    command: String,
    args: Vec<String>,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mut child = Command::new(&command)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "外部プラグインを起動できません: {}: {}",
                command,
                error,
            )
        })?;

    if let Some(stdin) = child.stdin.as_mut() {
        let bytes = serde_json::to_vec(&payload)
            .map_err(|error| {
                error.to_string()
            })?;

        stdin
            .write_all(&bytes)
            .map_err(|error| {
                error.to_string()
            })?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| {
            error.to_string()
        })?;

    if !output.status.success() {
        return Err(format!(
            "外部プラグインが失敗しました: {}",
            String::from_utf8_lossy(
                &output.stderr,
            ),
        ));
    }

    serde_json::from_slice(
        &output.stdout,
    )
    .map_err(|error| {
        format!(
            "外部プラグインの出力JSONが不正です: {} / {}",
            error,
            String::from_utf8_lossy(
                &output.stdout,
            ),
        )
    })
}

fn json_to_sql_value(
    value: &serde_json::Value,
) -> rusqlite::types::Value {
    match value {
        serde_json::Value::Null => {
            rusqlite::types::Value::Null
        }
        serde_json::Value::Bool(value) => {
            rusqlite::types::Value::Integer(
                if *value { 1 } else { 0 },
            )
        }
        serde_json::Value::Number(value) => {
            if let Some(integer) =
                value.as_i64()
            {
                rusqlite::types::Value::Integer(
                    integer,
                )
            } else {
                rusqlite::types::Value::Real(
                    value.as_f64().unwrap_or(0.0),
                )
            }
        }
        serde_json::Value::String(value) => {
            rusqlite::types::Value::Text(
                value.clone(),
            )
        }
        value => {
            rusqlite::types::Value::Text(
                value.to_string(),
            )
        }
    }
}

fn sql_value_to_json(
    value: rusqlite::types::ValueRef<'_>,
) -> serde_json::Value {
    match value {
        rusqlite::types::ValueRef::Null => {
            serde_json::Value::Null
        }
        rusqlite::types::ValueRef::Integer(
            value,
        ) => {
            serde_json::Value::from(value)
        }
        rusqlite::types::ValueRef::Real(
            value,
        ) => {
            serde_json::Value::from(value)
        }
        rusqlite::types::ValueRef::Text(
            value,
        ) => {
            serde_json::Value::String(
                String::from_utf8_lossy(
                    value,
                )
                .into_owned(),
            )
        }
        rusqlite::types::ValueRef::Blob(
            value,
        ) => {
            use base64::Engine;

            serde_json::Value::String(
                base64::engine::general_purpose::STANDARD
                    .encode(value),
            )
        }
    }
}

#[tauri::command]
fn http_request(
    url: String,
    method: String,
    headers: serde_json::Value,
    body: serde_json::Value,
    timeout_ms: u64,
) -> Result<serde_json::Value, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(
            std::time::Duration::from_millis(
                timeout_ms.clamp(
                    1,
                    300_000,
                ),
            ),
        )
        .build()
        .map_err(|error| error.to_string())?;

    let method = reqwest::Method::from_bytes(
        method.to_uppercase().as_bytes(),
    )
    .map_err(|error| error.to_string())?;

    let mut request =
        client.request(method, &url);

    if let Some(headers) =
        headers.as_object()
    {
        for (name, value) in headers {
            if let Some(value) =
                value.as_str()
            {
                request =
                    request.header(name.as_str(), value);
            }
        }
    }

    if !body.is_null() {
        if body.is_string() {
            request = request.body(
                body.as_str()
                    .unwrap_or_default()
                    .to_string(),
            );
        } else {
            request = request.json(&body);
        }
    }

    let response =
        request.send().map_err(
            |error| error.to_string(),
        )?;

    let status =
        response.status().as_u16();

    let response_headers =
        response
            .headers()
            .iter()
            .map(|(name, value)| {
                (
                    name.to_string(),
                    serde_json::Value::String(
                        value
                            .to_str()
                            .unwrap_or_default()
                            .to_string(),
                    ),
                )
            })
            .collect::<
                serde_json::Map<
                    String,
                    serde_json::Value,
                >,
            >();

    let text = response
        .text()
        .map_err(|error| {
            error.to_string()
        })?;

    let json =
        serde_json::from_str::<
            serde_json::Value,
        >(&text)
        .unwrap_or(
            serde_json::Value::Null,
        );

    Ok(serde_json::json!({
        "status": status,
        "headers": response_headers,
        "body": text,
        "json": json
    }))
}

#[tauri::command]
fn tcp_request(
    host: String,
    port: u16,
    data: String,
    timeout_ms: u64,
) -> Result<String, String> {
    use std::io::{
        Read,
        Write as IoWrite,
    };

    let timeout =
        std::time::Duration::from_millis(
            timeout_ms.clamp(
                1,
                300_000,
            ),
        );

    let address = format!(
        "{}:{}",
        host,
        port,
    );

    let socket_address = address
        .to_socket_addrs()
        .map_err(|error| {
            error.to_string()
        })?
        .next()
        .ok_or_else(|| {
            "接続先を解決できません。"
                .to_string()
        })?;

    use std::net::ToSocketAddrs;

    let mut stream =
        std::net::TcpStream::connect_timeout(
            &socket_address,
            timeout,
        )
        .map_err(|error| {
            error.to_string()
        })?;

    stream
        .set_read_timeout(Some(timeout))
        .map_err(|error| {
            error.to_string()
        })?;

    stream
        .set_write_timeout(Some(timeout))
        .map_err(|error| {
            error.to_string()
        })?;

    stream
        .write_all(data.as_bytes())
        .map_err(|error| {
            error.to_string()
        })?;

    let _ = stream.shutdown(
        std::net::Shutdown::Write,
    );

    let mut response = Vec::new();

    match stream.read_to_end(
        &mut response,
    ) {
        Ok(_) => {}
        Err(error)
            if error.kind()
                == std::io::ErrorKind::WouldBlock
                || error.kind()
                    == std::io::ErrorKind::TimedOut => {}
        Err(error) => {
            return Err(
                error.to_string(),
            );
        }
    }

    Ok(
        String::from_utf8_lossy(
            &response,
        )
        .into_owned(),
    )
}

#[tauri::command]
fn udp_request(
    host: String,
    port: u16,
    data: String,
    timeout_ms: u64,
) -> Result<String, String> {
    let socket =
        std::net::UdpSocket::bind(
            "0.0.0.0:0",
        )
        .map_err(|error| {
            error.to_string()
        })?;

    let timeout =
        std::time::Duration::from_millis(
            timeout_ms.clamp(
                1,
                300_000,
            ),
        );

    socket
        .set_read_timeout(Some(timeout))
        .map_err(|error| {
            error.to_string()
        })?;

    socket
        .send_to(
            data.as_bytes(),
            format!(
                "{}:{}",
                host,
                port,
            ),
        )
        .map_err(|error| {
            error.to_string()
        })?;

    let mut buffer =
        vec![0_u8; 65_507];

    match socket.recv_from(
        &mut buffer,
    ) {
        Ok((length, _)) => Ok(
            String::from_utf8_lossy(
                &buffer[..length],
            )
            .into_owned(),
        ),
        Err(error)
            if error.kind()
                == std::io::ErrorKind::WouldBlock
                || error.kind()
                    == std::io::ErrorKind::TimedOut =>
        {
            Ok(String::new())
        }
        Err(error) => {
            Err(error.to_string())
        }
    }
}

#[tauri::command]
fn sqlite_execute(
    path: String,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<usize, String> {
    let connection =
        rusqlite::Connection::open(path)
            .map_err(|error| {
                error.to_string()
            })?;

    let values = params
        .iter()
        .map(json_to_sql_value)
        .collect::<Vec<_>>();

    connection
        .execute(
            &sql,
            rusqlite::params_from_iter(
                values,
            ),
        )
        .map_err(|error| {
            error.to_string()
        })
}

#[tauri::command]
fn sqlite_query(
    path: String,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<Vec<serde_json::Value>, String> {
    let connection =
        rusqlite::Connection::open(path)
            .map_err(|error| {
                error.to_string()
            })?;

    let values = params
        .iter()
        .map(json_to_sql_value)
        .collect::<Vec<_>>();

    let mut statement =
        connection
            .prepare(&sql)
            .map_err(|error| {
                error.to_string()
            })?;

    let names = statement
        .column_names()
        .iter()
        .map(|name| {
            name.to_string()
        })
        .collect::<Vec<_>>();

    let rows = statement
        .query_map(
            rusqlite::params_from_iter(
                values,
            ),
            |row| {
                let mut object =
                    serde_json::Map::new();

                for (
                    index,
                    name,
                ) in names.iter().enumerate()
                {
                    object.insert(
                        name.clone(),
                        sql_value_to_json(
                            row.get_ref(
                                index,
                            )?,
                        ),
                    );
                }

                Ok(
                    serde_json::Value::Object(
                        object,
                    ),
                )
            },
        )
        .map_err(|error| {
            error.to_string()
        })?;

    rows.collect::<
        Result<Vec<_>, _>,
    >()
    .map_err(|error| {
        error.to_string()
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginPackageInfo {
    id: String,
    name: String,
    version: String,
    description: Option<String>,
    enabled: bool,
    path: String,
}

fn plugin_manifest_info(
    path: &std::path::Path,
) -> Result<PluginPackageInfo, String> {
    let contents = fs::read_to_string(path)
        .map_err(|error| error.to_string())?;

    let value = serde_json::from_str::<
        serde_json::Value,
    >(&contents)
    .map_err(|error| error.to_string())?;

    Ok(PluginPackageInfo {
        id: value
            .get("id")
            .and_then(
                serde_json::Value::as_str,
            )
            .ok_or_else(|| {
                format!(
                    "{}にidがありません。",
                    path.display(),
                )
            })?
            .to_string(),
        name: value
            .get("name")
            .and_then(
                serde_json::Value::as_str,
            )
            .unwrap_or("Unnamed Plugin")
            .to_string(),
        version: value
            .get("version")
            .and_then(
                serde_json::Value::as_str,
            )
            .unwrap_or("0.0.0")
            .to_string(),
        description: value
            .get("description")
            .and_then(
                serde_json::Value::as_str,
            )
            .map(str::to_string),
        enabled: value
            .get("enabled")
            .and_then(
                serde_json::Value::as_bool,
            )
            .unwrap_or(true),
        path: path
            .display()
            .to_string(),
    })
}

fn collect_package_info(
    directory: &std::path::Path,
    result: &mut Vec<PluginPackageInfo>,
) -> Result<(), String> {
    if !directory.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(directory)
        .map_err(|error| error.to_string())?
    {
        let path = entry
            .map_err(|error| error.to_string())?
            .path();

        if path.is_dir() {
            collect_package_info(
                &path,
                result,
            )?;

            continue;
        }

        let is_manifest = path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| {
                value.eq_ignore_ascii_case(
                    "json",
                ) ||
                value.eq_ignore_ascii_case(
                    "flpkg",
                )
            });

        if !is_manifest {
            continue;
        }

        if let Ok(info) =
            plugin_manifest_info(&path)
        {
            result.push(info);
        }
    }

    Ok(())
}

#[tauri::command]
fn list_plugin_packages(
    app: tauri::AppHandle,
) -> Result<Vec<PluginPackageInfo>, String> {
    use tauri::Manager;

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("plugins");

    let mut result = Vec::new();

    collect_package_info(
        &directory,
        &mut result,
    )?;

    result.sort_by(
        |a, b| a.name.cmp(&b.name),
    );

    Ok(result)
}

#[tauri::command]
fn install_plugin_package(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    use tauri::Manager;

    let source =
        PathBuf::from(path);

    let info =
        plugin_manifest_info(
            &source,
        )?;

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("plugins")
        .join(&info.id);

    fs::create_dir_all(
        &directory,
    )
    .map_err(|error| error.to_string())?;

    let destination =
        directory.join(
            "plugin.json",
        );

    fs::copy(
        &source,
        &destination,
    )
    .map_err(|error| error.to_string())?;

    Ok(
        destination
            .display()
            .to_string(),
    )
}

#[tauri::command]
fn uninstall_plugin_package(
    app: tauri::AppHandle,
    plugin_id: String,
) -> Result<(), String> {
    use tauri::Manager;

    if plugin_id.is_empty() ||
        plugin_id.contains("..") ||
        plugin_id.contains('/') ||
        plugin_id.contains('\\')
    {
        return Err(
            "プラグインIDが不正です。"
                .to_string(),
        );
    }

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("plugins")
        .join(plugin_id);

    if directory.exists() {
        fs::remove_dir_all(
            directory,
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn save_project_file(
    path: String,
    project_json: String,
) -> Result<(), String> {
    let path = ensure_flsc_extension(
        PathBuf::from(path),
    );

    fs::write(
        &path,
        project_json,
    )
    .map_err(|error| {
        format!(
            "プロジェクトを書き込めませんでした: {}: {}",
            path.display(),
            error,
        )
    })
}

#[tauri::command]
fn load_project_file(
    path: String,
) -> Result<String, String> {
    let path = PathBuf::from(path);

    fs::read_to_string(&path)
        .map_err(|error| {
            format!(
                "プロジェクトを読み込めませんでした: {}: {}",
                path.display(),
                error,
            )
        })
}

fn ensure_flsc_extension(
    mut path: PathBuf,
) -> PathBuf {
    let has_flsc = path
        .extension()
        .and_then(|extension| {
            extension.to_str()
        })
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case(
                "flsc",
            )
        });

    if !has_flsc {
        path.set_extension("flsc");
    }

    path
}

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_dialog::init(),
        )
        .plugin(
            tauri_plugin_fs::init(),
        )
        .invoke_handler(
            tauri::generate_handler![
                execute_program,
                build_program,
                load_installed_plugins,
                execute_external_plugin,
                http_request,
                tcp_request,
                udp_request,
                sqlite_execute,
                sqlite_query,
                list_plugin_packages,
                install_plugin_package,
                uninstall_plugin_package,
                save_project_file,
                load_project_file,
            ],
        )
        .run(
            tauri::generate_context!(),
        )
        .expect(
            "Tauriアプリケーションの起動に失敗しました",
        );
}
