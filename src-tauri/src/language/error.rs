use thiserror::Error;

#[derive(Debug, Error)]
pub enum LanguageError {
    #[error("未対応のフォーマットバージョンです: {0}")]
    UnsupportedFormat(u32),

    #[error("ノードIDが重複しています: {0}")]
    DuplicateNodeId(String),

    #[error("接続 {connection_id} のノードが存在しません: {node_id}")]
    MissingNode {
        connection_id: String,
        node_id: String,
    },

    #[error("ノード {0} の種類は登録されていません")]
    UnknownNodeType(String),

    #[error("ノード {node_id} に入力 {port} が接続されていません")]
    MissingInput { node_id: String, port: String },

    #[error("ノード {node_id} の入力 {port} に複数の接続があります")]
    MultipleInputConnections { node_id: String, port: String },

    #[error("接続 {connection_id} の出力ポートが不正です: {port}")]
    InvalidSourcePort {
        connection_id: String,
        port: String,
    },

    #[error("接続 {connection_id} の入力ポートが不正です: {port}")]
    InvalidTargetPort {
        connection_id: String,
        port: String,
    },

    #[error("接続 {connection_id} の型が一致しません: {source_type} → {target_type}")]
    TypeMismatch {
        connection_id: String,
        source_type: String,
        target_type: String,
    },

    #[error("グラフに循環があります")]
    CycleDetected,

    #[error("ノード {node_id} のプロパティが不正です: {message}")]
    InvalidProperty {
        node_id: String,
        message: String,
    },

    #[error("ノード {node_id} の入力 {port} が見つかりません")]
    InputValueMissing { node_id: String, port: String },

    #[error("ノード {node_id} の出力 {port} が見つかりません")]
    OutputValueMissing { node_id: String, port: String },

    #[error("ノード {node_id} の実行に失敗しました: {message}")]
    Execution {
        node_id: String,
        message: String,
    },
}
