use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowProgram {
    pub format_version: u32,
    pub nodes: Vec<ProgramNode>,
    pub connections: Vec<ProgramConnection>,
    #[serde(default)]
    pub plugins: Vec<PluginManifest>,
    #[serde(default)]
    pub runtime_inputs: HashMap<String, f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramNode {
    pub id: String,
    pub node_type: String,
    pub position: NodePosition,
    #[serde(default)]
    pub properties: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramConnection {
    pub id: String,
    pub source_node: String,
    pub source_port: String,
    pub target_node: String,
    pub target_port: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub modules: Vec<PluginModuleDefinition>,
    pub nodes: Vec<PluginNodeDefinition>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginModuleDefinition {
    pub id: String,
    #[serde(default)]
    pub version: Option<String>,
    pub kind: String,
    #[serde(default)]
    pub source: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginNodeDefinition {
    pub language_type: String,
    pub title: String,
    pub category: String,
    #[serde(default)]
    pub description: Option<String>,
    pub inputs: Vec<PluginPortDefinition>,
    pub outputs: Vec<PluginPortDefinition>,
    #[serde(default)]
    pub default_properties: HashMap<String, Value>,
    #[serde(default)]
    pub expression: Option<String>,
    #[serde(default)]
    pub runtime: Option<serde_json::Value>,
    #[serde(default)]
    pub required_modules: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPortDefinition {
    pub id: String,
    pub label: String,
    pub data_type: String,
    #[serde(default)]
    pub required: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildSettings {
    pub language: String,
    pub output_path: String,
    #[serde(default)]
    pub optimize: bool,
    #[serde(default)]
    pub pause_at_end: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResult {
    pub success: bool,
    pub logs: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub error: Option<String>,
}
