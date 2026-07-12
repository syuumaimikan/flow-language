use super::{
    error::LanguageError,
    graph::{
        FlowProgram,
        PluginNodeDefinition,
        ProgramConnection,
        ProgramNode,
    },
    value::RuntimeValue,
};
use evalexpr::{
    eval_with_context,
    ContextWithMutableVariables,
    DefaultNumericTypes,
    HashMapContext,
    Value as EvalValue,
};
use serde_json::Value;
use std::collections::{
    HashMap,
    HashSet,
};

type InputMap = HashMap<String, RuntimeValue>;
type OutputMap = HashMap<String, RuntimeValue>;

#[derive(Clone)]
struct PortSpec {
    id: String,
    data_type: String,
    required: bool,
}

#[derive(Clone)]
struct NodeSpec {
    inputs: Vec<PortSpec>,
    outputs: Vec<PortSpec>,
}

fn builtin_spec(node_type: &str) -> Option<NodeSpec> {
    match node_type {
        "core.number" | "core.input_number" => {
            Some(NodeSpec {
                inputs: vec![],
                outputs: vec![PortSpec {
                    id: "value".into(),
                    data_type: "number".into(),
                    required: false,
                }],
            })
        }

        "core.string" | "core.input_string" => {
            Some(NodeSpec {
                inputs: vec![],
                outputs: vec![PortSpec {
                    id: "value".into(),
                    data_type: "string".into(),
                    required: false,
                }],
            })
        }

        "core.boolean" => Some(NodeSpec {
            inputs: vec![],
            outputs: vec![PortSpec {
                id: "value".into(),
                data_type: "boolean".into(),
                required: false,
            }],
        }),

        "core.array" => Some(NodeSpec {
            inputs: vec![],
            outputs: vec![PortSpec {
                id: "value".into(),
                data_type: "array".into(),
                required: false,
            }],
        }),

        "core.object" => Some(NodeSpec {
            inputs: vec![],
            outputs: vec![PortSpec {
                id: "value".into(),
                data_type: "object".into(),
                required: false,
            }],
        }),

        "math.add" => Some(NodeSpec {
            inputs: vec![
                PortSpec {
                    id: "a".into(),
                    data_type: "number".into(),
                    required: true,
                },
                PortSpec {
                    id: "b".into(),
                    data_type: "number".into(),
                    required: true,
                },
            ],
            outputs: vec![PortSpec {
                id: "result".into(),
                data_type: "number".into(),
                required: false,
            }],
        }),


        "gui.label" => Some(NodeSpec {
            inputs: vec![PortSpec {
                id: "text".into(),
                data_type: "string".into(),
                required: true,
            }],
            outputs: vec![PortSpec {
                id: "component".into(),
                data_type: "object".into(),
                required: false,
            }],
        }),

        "gui.button" => Some(NodeSpec {
            inputs: vec![PortSpec {
                id: "text".into(),
                data_type: "string".into(),
                required: true,
            }],
            outputs: vec![PortSpec {
                id: "component".into(),
                data_type: "object".into(),
                required: false,
            }],
        }),

        "gui.input" => Some(NodeSpec {
            inputs: vec![
                PortSpec {
                    id: "placeholder".into(),
                    data_type: "string".into(),
                    required: false,
                },
                PortSpec {
                    id: "value".into(),
                    data_type: "string".into(),
                    required: false,
                },
            ],
            outputs: vec![PortSpec {
                id: "component".into(),
                data_type: "object".into(),
                required: false,
            }],
        }),

        "gui.row" | "gui.column" => Some(NodeSpec {
            inputs: vec![PortSpec {
                id: "children".into(),
                data_type: "array".into(),
                required: true,
            }],
            outputs: vec![PortSpec {
                id: "component".into(),
                data_type: "object".into(),
                required: false,
            }],
        }),

        "gui.window" => Some(NodeSpec {
            inputs: vec![
                PortSpec {
                    id: "title".into(),
                    data_type: "string".into(),
                    required: true,
                },
                PortSpec {
                    id: "content".into(),
                    data_type: "object".into(),
                    required: true,
                },
                PortSpec {
                    id: "width".into(),
                    data_type: "number".into(),
                    required: false,
                },
                PortSpec {
                    id: "height".into(),
                    data_type: "number".into(),
                    required: false,
                },
            ],
            outputs: vec![PortSpec {
                id: "window".into(),
                data_type: "object".into(),
                required: false,
            }],
        }),

        "gui.show" => Some(NodeSpec {
            inputs: vec![PortSpec {
                id: "window".into(),
                data_type: "object".into(),
                required: true,
            }],
            outputs: vec![PortSpec {
                id: "windowId".into(),
                data_type: "string".into(),
                required: false,
            }],
        }),

        "core.print" => Some(NodeSpec {
            inputs: vec![PortSpec {
                id: "input".into(),
                data_type: "any".into(),
                required: true,
            }],
            outputs: vec![],
        }),

        _ => None,
    }
}

fn plugin_map(
    program: &FlowProgram,
) -> HashMap<&str, &PluginNodeDefinition> {
    program
        .plugins
        .iter()
        .flat_map(|plugin| plugin.nodes.iter())
        .map(|node| {
            (node.language_type.as_str(), node)
        })
        .collect()
}

fn spec_for(
    node_type: &str,
    plugins: &HashMap<&str, &PluginNodeDefinition>,
) -> Option<NodeSpec> {
    builtin_spec(node_type).or_else(|| {
        plugins.get(node_type).map(|node| NodeSpec {
            inputs: node
                .inputs
                .iter()
                .map(|port| PortSpec {
                    id: port.id.clone(),
                    data_type: port.data_type.clone(),
                    required: port.required,
                })
                .collect(),
            outputs: node
                .outputs
                .iter()
                .map(|port| PortSpec {
                    id: port.id.clone(),
                    data_type: port.data_type.clone(),
                    required: port.required,
                })
                .collect(),
        })
    })
}

fn node_priority(node: &ProgramNode) -> (i64, String) {
    let order = if node.node_type == "core.print" {
        node.properties
            .get("executionOrder")
            .and_then(Value::as_i64)
            .unwrap_or(0)
    } else {
        i64::MIN
    };

    (order, node.id.clone())
}

pub fn execution_order(
    program: &FlowProgram,
) -> Result<Vec<String>, LanguageError> {
    let nodes: HashMap<&str, &ProgramNode> = program
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();

    let mut indegree: HashMap<&str, usize> = program
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), 0))
        .collect();
    let mut outgoing: HashMap<&str, Vec<&str>> =
        HashMap::new();

    for connection in &program.connections {
        if !nodes.contains_key(connection.source_node.as_str())
        {
            return Err(LanguageError::MissingNode {
                connection_id: connection.id.clone(),
                node_id: connection.source_node.clone(),
            });
        }

        if !nodes.contains_key(connection.target_node.as_str())
        {
            return Err(LanguageError::MissingNode {
                connection_id: connection.id.clone(),
                node_id: connection.target_node.clone(),
            });
        }

        *indegree
            .get_mut(connection.target_node.as_str())
            .expect("validated target") += 1;

        outgoing
            .entry(connection.source_node.as_str())
            .or_default()
            .push(connection.target_node.as_str());
    }

    let mut ready: Vec<&ProgramNode> = program
        .nodes
        .iter()
        .filter(|node| {
            indegree
                .get(node.id.as_str())
                .copied()
                .unwrap_or(0)
                == 0
        })
        .collect();
    let mut result = Vec::with_capacity(program.nodes.len());

    while !ready.is_empty() {
        ready.sort_by_key(|node| node_priority(node));
        let node = ready.remove(0);
        result.push(node.id.clone());

        if let Some(targets) =
            outgoing.get(node.id.as_str())
        {
            for target in targets {
                let degree = indegree
                    .get_mut(*target)
                    .expect("validated target");

                *degree -= 1;

                if *degree == 0 {
                    ready.push(
                        nodes
                            .get(*target)
                            .copied()
                            .expect("validated node"),
                    );
                }
            }
        }
    }

    if result.len() != program.nodes.len() {
        return Err(LanguageError::CycleDetected);
    }

    Ok(result)
}

pub fn execute(
    program: FlowProgram,
) -> Result<Vec<String>, LanguageError> {
    validate(&program)?;
    let order = execution_order(&program)?;
    let nodes: HashMap<&str, &ProgramNode> = program
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let incoming = incoming(&program.connections);
    let plugins = plugin_map(&program);
    let mut values: HashMap<
        (String, String),
        RuntimeValue,
    > = HashMap::new();
    let mut logs = vec![];

    for id in order {
        let node = nodes[id.as_str()];
        let inputs =
            collect_inputs(node, &incoming, &values)?;
        let outputs = execute_node(
            node,
            &inputs,
            &plugins,
            &program.runtime_inputs,
            &mut logs,
        )?;

        for (port, value) in outputs {
            values.insert(
                (node.id.clone(), port),
                value,
            );
        }
    }

    Ok(logs)
}

fn validate(
    program: &FlowProgram,
) -> Result<(), LanguageError> {
    if program.format_version != 3 {
        return Err(LanguageError::UnsupportedFormat(
            program.format_version,
        ));
    }

    let plugins = plugin_map(program);
    let mut ids = HashSet::new();

    for node in &program.nodes {
        if !ids.insert(&node.id) {
            return Err(
                LanguageError::DuplicateNodeId(
                    node.id.clone(),
                ),
            );
        }

        if spec_for(&node.node_type, &plugins)
            .is_none()
        {
            return Err(
                LanguageError::UnknownNodeType(
                    node.node_type.clone(),
                ),
            );
        }
    }

    let map: HashMap<&str, &ProgramNode> = program
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let mut targets = HashSet::new();

    for connection in &program.connections {
        let source = map
            .get(connection.source_node.as_str())
            .ok_or_else(|| {
                LanguageError::MissingNode {
                    connection_id:
                        connection.id.clone(),
                    node_id:
                        connection.source_node.clone(),
                }
            })?;
        let target = map
            .get(connection.target_node.as_str())
            .ok_or_else(|| {
                LanguageError::MissingNode {
                    connection_id:
                        connection.id.clone(),
                    node_id:
                        connection.target_node.clone(),
                }
            })?;

        let source_spec =
            spec_for(&source.node_type, &plugins)
                .expect("validated source type");
        let target_spec =
            spec_for(&target.node_type, &plugins)
                .expect("validated target type");

        let source_port = source_spec
            .outputs
            .iter()
            .find(|port| {
                port.id == connection.source_port
            })
            .ok_or_else(|| {
                LanguageError::InvalidSourcePort {
                    connection_id:
                        connection.id.clone(),
                    port:
                        connection.source_port.clone(),
                }
            })?;
        let target_port = target_spec
            .inputs
            .iter()
            .find(|port| {
                port.id == connection.target_port
            })
            .ok_or_else(|| {
                LanguageError::InvalidTargetPort {
                    connection_id:
                        connection.id.clone(),
                    port:
                        connection.target_port.clone(),
                }
            })?;

        if !(
            source_port.data_type
                == target_port.data_type
                || source_port.data_type == "any"
                || target_port.data_type == "any"
        ) {
            return Err(LanguageError::TypeMismatch {
                connection_id:
                    connection.id.clone(),
                source_type:
                    source_port.data_type.clone(),
                target_type:
                    target_port.data_type.clone(),
            });
        }

        if !targets.insert((
            connection.target_node.as_str(),
            connection.target_port.as_str(),
        )) {
            return Err(
                LanguageError::MultipleInputConnections {
                    node_id:
                        connection.target_node.clone(),
                    port:
                        connection.target_port.clone(),
                },
            );
        }
    }

    for node in &program.nodes {
        let spec =
            spec_for(&node.node_type, &plugins)
                .expect("validated type");

        for port in spec
            .inputs
            .iter()
            .filter(|port| port.required)
        {
            if !program.connections.iter().any(
                |connection| {
                    connection.target_node == node.id
                        && connection.target_port
                            == port.id
                },
            ) {
                return Err(
                    LanguageError::MissingInput {
                        node_id: node.id.clone(),
                        port: port.id.clone(),
                    },
                );
            }
        }
    }

    execution_order(program)?;
    Ok(())
}

fn incoming(
    connections: &[ProgramConnection],
) -> HashMap<&str, Vec<&ProgramConnection>> {
    let mut result = HashMap::new();

    for connection in connections {
        result
            .entry(connection.target_node.as_str())
            .or_insert_with(Vec::new)
            .push(connection);
    }

    result
}

fn collect_inputs(
    node: &ProgramNode,
    incoming: &HashMap<
        &str,
        Vec<&ProgramConnection>,
    >,
    values: &HashMap<
        (String, String),
        RuntimeValue,
    >,
) -> Result<InputMap, LanguageError> {
    let mut result = HashMap::new();

    if let Some(connections) =
        incoming.get(node.id.as_str())
    {
        for connection in connections {
            let value = values
                .get(&(
                    connection.source_node.clone(),
                    connection.source_port.clone(),
                ))
                .cloned()
                .ok_or_else(|| {
                    LanguageError::OutputValueMissing {
                        node_id:
                            connection.source_node.clone(),
                        port:
                            connection.source_port.clone(),
                    }
                })?;

            result.insert(
                connection.target_port.clone(),
                value,
            );
        }
    }

    Ok(result)
}

fn execute_node(
    node: &ProgramNode,
    inputs: &InputMap,
    plugins: &HashMap<
        &str,
        &PluginNodeDefinition,
    >,
    runtime_inputs: &HashMap<String, f64>,
    logs: &mut Vec<String>,
) -> Result<OutputMap, LanguageError> {
    match node.node_type.as_str() {
        "core.number" => {
            let value = node
                .properties
                .get("value")
                .and_then(Value::as_f64)
                .ok_or_else(|| {
                    LanguageError::InvalidProperty {
                        node_id: node.id.clone(),
                        message:
                            "valueには数値が必要です"
                                .into(),
                    }
                })?;

            Ok(HashMap::from([(
                "value".into(),
                RuntimeValue::Number(value),
            )]))
        }

        "core.input_number" => {
            let value = runtime_inputs
                .get(&node.id)
                .copied()
                .or_else(|| {
                    node.properties
                        .get("defaultValue")
                        .and_then(Value::as_f64)
                })
                .unwrap_or(0.0);

            Ok(HashMap::from([(
                "value".into(),
                RuntimeValue::Number(value),
            )]))
        }

        "core.string" => {
            let value = node
                .properties
                .get("value")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();

            Ok(HashMap::from([(
                "value".into(),
                RuntimeValue::String(value),
            )]))
        }

        "core.input_string" => {
            let value = node
                .properties
                .get("runtimeValue")
                .and_then(Value::as_str)
                .or_else(|| {
                    node.properties
                        .get("defaultValue")
                        .and_then(Value::as_str)
                })
                .unwrap_or_default()
                .to_string();

            Ok(HashMap::from([(
                "value".into(),
                RuntimeValue::String(value),
            )]))
        }

        "core.boolean" => {
            let value = node
                .properties
                .get("value")
                .and_then(Value::as_bool)
                .unwrap_or(false);

            Ok(HashMap::from([(
                "value".into(),
                RuntimeValue::Boolean(value),
            )]))
        }

        "core.array" => {
            let value = node
                .properties
                .get("value")
                .cloned()
                .unwrap_or_else(|| Value::Array(vec![]));

            if !value.is_array() {
                return Err(LanguageError::InvalidProperty {
                    node_id: node.id.clone(),
                    message: "valueには配列が必要です".into(),
                });
            }

            Ok(HashMap::from([(
                "value".into(),
                RuntimeValue::Json(value),
            )]))
        }

        "core.object" => {
            let value = node
                .properties
                .get("value")
                .cloned()
                .unwrap_or_else(|| Value::Object(Default::default()));

            if !value.is_object() {
                return Err(LanguageError::InvalidProperty {
                    node_id: node.id.clone(),
                    message: "valueにはオブジェクトが必要です".into(),
                });
            }

            Ok(HashMap::from([(
                "value".into(),
                RuntimeValue::Json(value),
            )]))
        }

        "math.add" => {
            let a = required(node, inputs, "a")?
                .as_number()
                .map_err(|message| {
                    LanguageError::Execution {
                        node_id: node.id.clone(),
                        message,
                    }
                })?;
            let b = required(node, inputs, "b")?
                .as_number()
                .map_err(|message| {
                    LanguageError::Execution {
                        node_id: node.id.clone(),
                        message,
                    }
                })?;

            Ok(HashMap::from([(
                "result".into(),
                RuntimeValue::Number(a + b),
            )]))
        }


        "gui.label" => {
            let text = required(node, inputs, "text")?
                .to_string();

            Ok(HashMap::from([(
                "component".into(),
                RuntimeValue::Json(serde_json::json!({
                    "id": node.id,
                    "kind": "label",
                    "text": text
                })),
            )]))
        }

        "gui.button" => {
            let text = required(node, inputs, "text")?
                .to_string();

            Ok(HashMap::from([(
                "component".into(),
                RuntimeValue::Json(serde_json::json!({
                    "id": node.id,
                    "kind": "button",
                    "text": text
                })),
            )]))
        }

        "gui.input" => {
            let placeholder = inputs
                .get("placeholder")
                .map(ToString::to_string)
                .unwrap_or_default();

            let value = inputs
                .get("value")
                .map(ToString::to_string)
                .unwrap_or_default();

            Ok(HashMap::from([(
                "component".into(),
                RuntimeValue::Json(serde_json::json!({
                    "id": node.id,
                    "kind": "input",
                    "text": placeholder,
                    "value": value
                })),
            )]))
        }

        "gui.row" | "gui.column" => {
            let children = required(
                node,
                inputs,
                "children",
            )?;

            let RuntimeValue::Json(children) = children else {
                return Err(LanguageError::Execution {
                    node_id: node.id.clone(),
                    message:
                        "childrenには配列が必要です"
                            .into(),
                });
            };

            if !children.is_array() {
                return Err(LanguageError::Execution {
                    node_id: node.id.clone(),
                    message:
                        "childrenには配列が必要です"
                            .into(),
                });
            }

            Ok(HashMap::from([(
                "component".into(),
                RuntimeValue::Json(serde_json::json!({
                    "id": node.id,
                    "kind": if node.node_type == "gui.row" {
                        "row"
                    } else {
                        "column"
                    },
                    "children": children
                })),
            )]))
        }

        "gui.window" => {
            let title = required(
                node,
                inputs,
                "title",
            )?
            .to_string();

            let content = required(
                node,
                inputs,
                "content",
            )?;

            let RuntimeValue::Json(content) = content else {
                return Err(LanguageError::Execution {
                    node_id: node.id.clone(),
                    message:
                        "contentにはGUIコンポーネントが必要です"
                            .into(),
                });
            };

            let width = inputs
                .get("width")
                .and_then(|value| value.as_number().ok())
                .unwrap_or(480.0);

            let height = inputs
                .get("height")
                .and_then(|value| value.as_number().ok())
                .unwrap_or(240.0);

            Ok(HashMap::from([(
                "window".into(),
                RuntimeValue::Json(serde_json::json!({
                    "id": node.id,
                    "kind": "window",
                    "title": title,
                    "width": width,
                    "height": height,
                    "children": [content]
                })),
            )]))
        }

        "gui.show" => {
            let window = required(
                node,
                inputs,
                "window",
            )?;

            let RuntimeValue::Json(window) = window else {
                return Err(LanguageError::Execution {
                    node_id: node.id.clone(),
                    message:
                        "windowにはGUI Window仕様が必要です"
                            .into(),
                });
            };

            logs.push(format!(
                "GUI Window: {}",
                window
            ));

            Ok(HashMap::from([(
                "windowId".into(),
                RuntimeValue::String(
                    node.id.clone(),
                ),
            )]))
        }

        "core.print" => {
            logs.push(
                required(node, inputs, "input")?
                    .to_string(),
            );
            Ok(HashMap::new())
        }

        other => {
            let definition =
                plugins.get(other).ok_or_else(|| {
                    LanguageError::UnknownNodeType(
                        other.into(),
                    )
                })?;

            execute_plugin(node, inputs, definition)
        }
    }
}

fn execute_plugin(
    node: &ProgramNode,
    inputs: &InputMap,
    definition: &PluginNodeDefinition,
) -> Result<OutputMap, LanguageError> {
    let mut context =
        HashMapContext::<DefaultNumericTypes>::new();

    for (name, value) in inputs {
        let number =
            value.as_number().map_err(|message| {
                LanguageError::Execution {
                    node_id: node.id.clone(),
                    message,
                }
            })?;

        context
            .set_value(
                name.clone(),
                EvalValue::Float(number),
            )
            .map_err(|error| {
                LanguageError::Execution {
                    node_id: node.id.clone(),
                    message: error.to_string(),
                }
            })?;
    }

    let result = eval_with_context(
        definition.expression.as_deref().ok_or_else(|| LanguageError::Execution { node_id: node.id.clone(), message: "JavaScriptプラグインはRust実行エンジンでは実行できません".into() })?,
        &context,
    )
    .map_err(|error| {
        LanguageError::Execution {
            node_id: node.id.clone(),
            message: error.to_string(),
        }
    })?;
    let number =
        result.as_number().map_err(|error| {
            LanguageError::Execution {
                node_id: node.id.clone(),
                message: error.to_string(),
            }
        })?;
    let port =
        definition.outputs.first().ok_or_else(|| {
            LanguageError::Execution {
                node_id: node.id.clone(),
                message:
                    "出力ポートがありません".into(),
            }
        })?;

    Ok(HashMap::from([(
        port.id.clone(),
        RuntimeValue::Number(number),
    )]))
}

fn required<'a>(
    node: &ProgramNode,
    inputs: &'a InputMap,
    port: &str,
) -> Result<&'a RuntimeValue, LanguageError> {
    inputs.get(port).ok_or_else(|| {
        LanguageError::InputValueMissing {
            node_id: node.id.clone(),
            port: port.into(),
        }
    })
}
