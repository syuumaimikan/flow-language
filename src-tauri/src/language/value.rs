use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum RuntimeValue {
    Number(f64),
    String(String),
    Boolean(bool),
    Json(serde_json::Value),
    None,
}

impl RuntimeValue {
    pub fn as_number(&self) -> Result<f64, String> {
        match self {
            Self::Number(value) => Ok(*value),
            other => Err(format!(
                "数値が必要ですが、{}が渡されました",
                other.type_name(),
            )),
        }
    }

    pub fn type_name(&self) -> &'static str {
        match self {
            Self::Number(_) => "number",
            Self::String(_) => "string",
            Self::Boolean(_) => "boolean",
            Self::Json(value) if value.is_array() => "array",
            Self::Json(value) if value.is_object() => "object",
            Self::Json(_) => "json",
            Self::None => "none",
        }
    }
}

impl fmt::Display for RuntimeValue {
    fn fmt(
        &self,
        formatter: &mut fmt::Formatter<'_>,
    ) -> fmt::Result {
        match self {
            Self::Number(value) => write!(formatter, "{value}"),
            Self::String(value) => write!(formatter, "{value}"),
            Self::Boolean(value) => write!(formatter, "{value}"),
            Self::Json(value) => write!(formatter, "{value}"),
            Self::None => write!(formatter, "None"),
        }
    }
}
