import type {
  PluginManifest,
  PluginNodeDefinition,
  PortDefinition,
} from "./types";

export interface NodeDefinition {
  languageType: string;
  title: string;
  editorType:
    | "value"
    | "input"
    | "operation"
    | "control"
    | "variable"
    | "error"
    | "comment"
    | "file"
    | "string"
    | "collection"
    | "object"
    | "output"
    | "plugin";
  category: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  defaultProperties: Record<string, unknown>;
}

const input = (
  id: string,
  label: string,
  dataType: PortDefinition["dataType"] = "any",
  required = true,
): PortDefinition => ({
  id,
  label,
  dataType,
  required,
});

const output = (
  id: string,
  label: string,
  dataType: PortDefinition["dataType"] = "any",
): PortDefinition => ({
  id,
  label,
  dataType,
});

const common = {
  parallel: false,
  breakpoint: false,
};

export const BUILTIN_NODE_DEFINITIONS: Record<
  string,
  NodeDefinition
> = {
  "core.number": {
    languageType: "core.number",
    title: "Number",
    editorType: "value",
    category: "値",
    description: "数値を出力します。",
    inputs: [],
    outputs: [output("value", "Value", "number")],
    defaultProperties: {
      ...common,
      value: 0,
    },
  },

  "core.string": {
    languageType: "core.string",
    title: "String",
    editorType: "value",
    category: "値",
    description: "文字列を出力します。",
    inputs: [],
    outputs: [output("value", "Value", "string")],
    defaultProperties: {
      ...common,
      value: "",
    },
  },

  "core.boolean": {
    languageType: "core.boolean",
    title: "Boolean",
    editorType: "value",
    category: "値",
    description: "TrueまたはFalseを出力します。",
    inputs: [],
    outputs: [output("value", "Value", "boolean")],
    defaultProperties: {
      ...common,
      value: false,
    },
  },

  "core.array": {
    languageType: "core.array",
    title: "Array",
    editorType: "value",
    category: "値",
    description: "JSON形式の配列を出力します。",
    inputs: [],
    outputs: [output("value", "Value", "array")],
    defaultProperties: {
      ...common,
      value: [],
    },
  },

  "core.object": {
    languageType: "core.object",
    title: "Object / Struct",
    editorType: "object",
    category: "値",
    description: "JSON形式のオブジェクトまたは構造体を出力します。",
    inputs: [],
    outputs: [output("value", "Value", "object")],
    defaultProperties: {
      ...common,
      value: {},
    },
  },

  "core.input_number": {
    languageType: "core.input_number",
    title: "Number Input",
    editorType: "input",
    category: "入力",
    description: "実行時にユーザーから数値を受け取ります。",
    inputs: [],
    outputs: [output("value", "Value", "number")],
    defaultProperties: {
      ...common,
      prompt: "数値を入力してください",
      defaultValue: 0,
    },
  },

  "core.input_string": {
    languageType: "core.input_string",
    title: "Text Input",
    editorType: "input",
    category: "入力",
    description: "実行時にユーザーから文字列を受け取ります。",
    inputs: [],
    outputs: [output("value", "Value", "string")],
    defaultProperties: {
      ...common,
      prompt: "文字を入力してください",
      defaultValue: "",
    },
  },

  "math.add": {
    languageType: "math.add",
    title: "Add",
    editorType: "operation",
    category: "計算",
    description: "AとBを加算します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "number")],
    defaultProperties: common,
  },

  "math.subtract": {
    languageType: "math.subtract",
    title: "Subtract",
    editorType: "operation",
    category: "計算",
    description: "AからBを減算します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "number")],
    defaultProperties: common,
  },

  "math.multiply": {
    languageType: "math.multiply",
    title: "Multiply",
    editorType: "operation",
    category: "計算",
    description: "AとBを乗算します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "number")],
    defaultProperties: common,
  },

  "math.divide": {
    languageType: "math.divide",
    title: "Divide",
    editorType: "operation",
    category: "計算",
    description: "AをBで除算します。Bが0の場合はエラーになります。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "number")],
    defaultProperties: common,
  },

  "math.modulo": {
    languageType: "math.modulo",
    title: "Modulo",
    editorType: "operation",
    category: "計算",
    description: "AをBで割った余りを返します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "number")],
    defaultProperties: common,
  },

  "math.power": {
    languageType: "math.power",
    title: "Power",
    editorType: "operation",
    category: "計算",
    description: "AのB乗を計算します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "number")],
    defaultProperties: common,
  },

  "compare.equal": {
    languageType: "compare.equal",
    title: "Equal ==",
    editorType: "operation",
    category: "条件・比較",
    description: "AとBが厳密に等しいか判定します。",
    inputs: [
      input("a", "A"),
      input("b", "B"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.not_equal": {
    languageType: "compare.not_equal",
    title: "Not Equal !=",
    editorType: "operation",
    category: "条件・比較",
    description: "AとBが異なるか判定します。",
    inputs: [
      input("a", "A"),
      input("b", "B"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.greater": {
    languageType: "compare.greater",
    title: "Greater >",
    editorType: "operation",
    category: "条件・比較",
    description: "AがBより大きいか判定します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.less": {
    languageType: "compare.less",
    title: "Less <",
    editorType: "operation",
    category: "条件・比較",
    description: "AがBより小さいか判定します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.greater_equal": {
    languageType: "compare.greater_equal",
    title: "Greater Equal >=",
    editorType: "operation",
    category: "条件・比較",
    description: "AがB以上か判定します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.less_equal": {
    languageType: "compare.less_equal",
    title: "Less Equal <=",
    editorType: "operation",
    category: "条件・比較",
    description: "AがB以下か判定します。",
    inputs: [
      input("a", "A", "number"),
      input("b", "B", "number"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.between": {
    languageType: "compare.between",
    title: "Between",
    editorType: "operation",
    category: "条件・比較",
    description: "ValueがMin以上Max以下か判定します。",
    inputs: [
      input("value", "Value", "number"),
      input("min", "Min", "number"),
      input("max", "Max", "number"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.is_null": {
    languageType: "compare.is_null",
    title: "Is Null",
    editorType: "operation",
    category: "条件・比較",
    description: "値がnullまたはundefinedか判定します。",
    inputs: [input("value", "Value")],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "compare.type_is": {
    languageType: "compare.type_is",
    title: "Type Is",
    editorType: "operation",
    category: "条件・比較",
    description:
      "値の型が指定した型名と一致するか判定します。number/string/boolean/array/objectを指定できます。",
    inputs: [
      input("value", "Value"),
      input("type", "Type", "string"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "logic.and": {
    languageType: "logic.and",
    title: "AND",
    editorType: "operation",
    category: "条件・論理",
    description: "AとBの両方がTrueの場合にTrueを返します。",
    inputs: [
      input("a", "A", "boolean"),
      input("b", "B", "boolean"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "logic.or": {
    languageType: "logic.or",
    title: "OR",
    editorType: "operation",
    category: "条件・論理",
    description: "AまたはBがTrueの場合にTrueを返します。",
    inputs: [
      input("a", "A", "boolean"),
      input("b", "B", "boolean"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "logic.xor": {
    languageType: "logic.xor",
    title: "XOR",
    editorType: "operation",
    category: "条件・論理",
    description: "AとBの一方だけがTrueの場合にTrueを返します。",
    inputs: [
      input("a", "A", "boolean"),
      input("b", "B", "boolean"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "logic.not": {
    languageType: "logic.not",
    title: "NOT",
    editorType: "operation",
    category: "条件・論理",
    description: "入力した論理値を反転します。",
    inputs: [input("value", "Value", "boolean")],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "logic.if": {
    languageType: "logic.if",
    title: "IF",
    editorType: "control",
    category: "制御",
    description:
      "ConditionがTrueならTrue入力、FalseならFalse入力を返します。",
    inputs: [
      input("condition", "Condition", "boolean"),
      input("whenTrue", "True"),
      input("whenFalse", "False"),
    ],
    outputs: [output("result", "Result")],
    defaultProperties: common,
  },

  "logic.switch": {
    languageType: "logic.switch",
    title: "SWITCH",
    editorType: "control",
    category: "制御",
    description:
      "KeyをCasesオブジェクトのキーとして検索し、見つからない場合はDefaultを返します。",
    inputs: [
      input("key", "Key", "string"),
      input("cases", "Cases", "object"),
      input("default", "Default", "any", false),
    ],
    outputs: [output("result", "Result")],
    defaultProperties: common,
  },

  "variable.set": {
    languageType: "variable.set",
    title: "Set Variable",
    editorType: "variable",
    category: "変数",
    description:
      "名前付き変数へ値を代入します。出力を次の処理へ接続すると実行順を固定できます。",
    inputs: [
      input("name", "Name", "string"),
      input("value", "Value"),
    ],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "variable.get": {
    languageType: "variable.get",
    title: "Get Variable",
    editorType: "variable",
    category: "変数",
    description:
      "名前付き変数を取得します。Afterは実行順を指定するための任意入力です。",
    inputs: [
      input("name", "Name", "string"),
      input("after", "After", "any", false),
    ],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "variable.exists": {
    languageType: "variable.exists",
    title: "Variable Exists",
    editorType: "variable",
    category: "変数",
    description: "指定した変数が存在するか判定します。",
    inputs: [input("name", "Name", "string")],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "variable.delete": {
    languageType: "variable.delete",
    title: "Delete Variable",
    editorType: "variable",
    category: "変数",
    description: "指定した変数を削除します。",
    inputs: [input("name", "Name", "string")],
    outputs: [output("success", "Success", "boolean")],
    defaultProperties: common,
  },

  "loop.break_if": {
    languageType: "loop.break_if",
    title: "Break If",
    editorType: "control",
    category: "ループ",
    description:
      "ConditionがTrueの場合、現在のループグループを終了します。",
    inputs: [input("condition", "Condition", "boolean")],
    outputs: [],
    defaultProperties: common,
  },

  "loop.continue_if": {
    languageType: "loop.continue_if",
    title: "Continue If",
    editorType: "control",
    category: "ループ",
    description:
      "ConditionがTrueの場合、現在の反復の残りを飛ばして次の反復へ進みます。",
    inputs: [input("condition", "Condition", "boolean")],
    outputs: [],
    defaultProperties: common,
  },

  "error.throw": {
    languageType: "error.throw",
    title: "Throw Error",
    editorType: "error",
    category: "例外",
    description:
      "Messageを持つ例外を発生させます。Try/Catchグループ内なら捕捉できます。",
    inputs: [input("message", "Message", "string")],
    outputs: [],
    defaultProperties: common,
  },

  "error.message": {
    languageType: "error.message",
    title: "Last Error Message",
    editorType: "error",
    category: "例外",
    description:
      "Try/Catchグループが保存したエラー変数を文字列として取得します。",
    inputs: [input("name", "Variable", "string")],
    outputs: [output("message", "Message", "string")],
    defaultProperties: common,
  },

  "core.comment": {
    languageType: "core.comment",
    title: "Comment",
    editorType: "comment",
    category: "ドキュメント",
    description:
      "プログラムの説明を書くための実行されないノードです。",
    inputs: [],
    outputs: [],
    defaultProperties: {
      comment: "コメントを入力",
      breakpoint: false,
      parallel: false,
    },
  },


  "function.define": {
    languageType: "function.define",
    title: "Define Function",
    editorType: "control",
    category: "関数",
    description:
      "名前付き関数を登録します。BodyはJavaScript式です。再帰にはrecur(...)を使用できます。",
    inputs: [input("after", "After", "any", false)],
    outputs: [output("function", "Function")],
    defaultProperties: {
      ...common,
      functionName: "myFunction",
      parameters: "x",
      functionBody: "x * 2",
      functionAsync: false,
      recursionLimit: 128,
    },
  },

  "function.subroutine": {
    languageType: "function.subroutine",
    title: "Define Subroutine",
    editorType: "control",
    category: "関数",
    description:
      "文形式の処理を持つサブルーチンを登録します。Body内でreturnを使用できます。",
    inputs: [input("after", "After", "any", false)],
    outputs: [output("function", "Function")],
    defaultProperties: {
      ...common,
      functionName: "mySubroutine",
      parameters: "value",
      functionBody: "return value;",
      functionAsync: false,
      recursionLimit: 128,
    },
  },

  "function.lambda": {
    languageType: "function.lambda",
    title: "Lambda",
    editorType: "control",
    category: "関数",
    description:
      "匿名関数を作成します。BodyはJavaScript式で、recur(...)による再帰にも対応します。",
    inputs: [],
    outputs: [output("function", "Function")],
    defaultProperties: {
      ...common,
      parameters: "x",
      functionBody: "x * 2",
      functionAsync: false,
      recursionLimit: 128,
    },
  },

  "function.call": {
    languageType: "function.call",
    title: "Call Function",
    editorType: "control",
    category: "関数",
    description:
      "関数値と引数配列を受け取り、関数を呼び出します。",
    inputs: [
      input("function", "Function"),
      input("args", "Args", "array"),
    ],
    outputs: [output("result", "Result")],
    defaultProperties: common,
  },

  "function.call_named": {
    languageType: "function.call_named",
    title: "Call Named Function",
    editorType: "control",
    category: "関数",
    description:
      "Define Functionで登録した名前付き関数を呼び出します。",
    inputs: [
      input("name", "Name", "string"),
      input("args", "Args", "array"),
      input("after", "After", "any", false),
    ],
    outputs: [output("result", "Result")],
    defaultProperties: common,
  },

  "type.infer": {
    languageType: "type.infer",
    title: "Infer Type",
    editorType: "operation",
    category: "型システム",
    description:
      "実行時の値からnumber/string/boolean/array/object/option/unionなどの型を推論します。",
    inputs: [input("value", "Value")],
    outputs: [output("type", "Type", "string")],
    defaultProperties: common,
  },

  "type.assert": {
    languageType: "type.assert",
    title: "Type Assert",
    editorType: "operation",
    category: "型システム",
    description:
      "値が指定型と一致しない場合に例外を発生させます。",
    inputs: [
      input("value", "Value"),
      input("type", "Type", "string"),
    ],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "generic.identity": {
    languageType: "generic.identity",
    title: "Generic Identity<T>",
    editorType: "operation",
    category: "型システム",
    description:
      "入力された任意型Tを同じ型のまま返すジェネリックノードです。",
    inputs: [input("value", "Value")],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "generic.pair": {
    languageType: "generic.pair",
    title: "Generic Pair<A,B>",
    editorType: "operation",
    category: "型システム",
    description:
      "異なる任意型AとBを不変なペアとしてまとめます。",
    inputs: [input("first", "First"), input("second", "Second")],
    outputs: [output("pair", "Pair", "object")],
    defaultProperties: common,
  },

  "option.some": {
    languageType: "option.some",
    title: "Some<T>",
    editorType: "operation",
    category: "Option・Union",
    description: "値をOptionのSomeとして包みます。",
    inputs: [input("value", "Value")],
    outputs: [output("option", "Option", "object")],
    defaultProperties: common,
  },

  "option.none": {
    languageType: "option.none",
    title: "None<T>",
    editorType: "operation",
    category: "Option・Union",
    description: "値を持たないOptionを作ります。",
    inputs: [],
    outputs: [output("option", "Option", "object")],
    defaultProperties: common,
  },

  "option.is_some": {
    languageType: "option.is_some",
    title: "Is Some",
    editorType: "operation",
    category: "Option・Union",
    description: "OptionがSomeか判定します。",
    inputs: [input("option", "Option", "object")],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "option.unwrap_or": {
    languageType: "option.unwrap_or",
    title: "Unwrap Or",
    editorType: "operation",
    category: "Option・Union",
    description: "Someなら値を、NoneならDefaultを返します。",
    inputs: [input("option", "Option", "object"), input("default", "Default")],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "union.create": {
    languageType: "union.create",
    title: "Create Union",
    editorType: "operation",
    category: "Option・Union",
    description: "TagとValueを持つ判別可能Union値を作ります。",
    inputs: [input("tag", "Tag", "string"), input("value", "Value")],
    outputs: [output("union", "Union", "object")],
    defaultProperties: common,
  },

  "union.match": {
    languageType: "union.match",
    title: "Match Union",
    editorType: "control",
    category: "Option・Union",
    description:
      "UnionのTagをCasesオブジェクトで照合します。ケース値が関数ならUnionの値を引数に呼び出します。",
    inputs: [
      input("union", "Union", "object"),
      input("cases", "Cases", "object"),
      input("default", "Default", "any", false),
    ],
    outputs: [output("result", "Result")],
    defaultProperties: common,
  },

  "struct.create": {
    languageType: "struct.create",
    title: "Create Struct",
    editorType: "object",
    category: "構造体・クラス",
    description:
      "Schemaの各フィールド型を検証し、不変な構造体値を作ります。",
    inputs: [
      input("name", "Name", "string"),
      input("schema", "Schema", "object"),
      input("values", "Values", "object"),
    ],
    outputs: [output("struct", "Struct", "object")],
    defaultProperties: common,
  },

  "struct.get": {
    languageType: "struct.get",
    title: "Get Struct Field",
    editorType: "object",
    category: "構造体・クラス",
    description: "構造体フィールドを取得します。",
    inputs: [input("struct", "Struct", "object"), input("key", "Key", "string")],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "class.create": {
    languageType: "class.create",
    title: "Create Class",
    editorType: "object",
    category: "構造体・クラス",
    description:
      "クラス名、フィールド、メソッド定義からクラスインスタンスを作ります。Methodsはメソッド名からJavaScript本文へのオブジェクトです。",
    inputs: [
      input("name", "Class", "string"),
      input("fields", "Fields", "object"),
      input("methods", "Methods", "object"),
    ],
    outputs: [output("instance", "Instance", "object")],
    defaultProperties: common,
  },

  "class.get": {
    languageType: "class.get",
    title: "Get Class Field",
    editorType: "object",
    category: "構造体・クラス",
    description: "クラスインスタンスのフィールドを取得します。",
    inputs: [input("instance", "Instance", "object"), input("key", "Key", "string")],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "class.with_field": {
    languageType: "class.with_field",
    title: "With Class Field",
    editorType: "object",
    category: "構造体・クラス",
    description:
      "元のインスタンスを変更せず、指定フィールドを変更した新しいインスタンスを返します。",
    inputs: [
      input("instance", "Instance", "object"),
      input("key", "Key", "string"),
      input("value", "Value"),
    ],
    outputs: [output("instance", "Instance", "object")],
    defaultProperties: common,
  },

  "class.call_method": {
    languageType: "class.call_method",
    title: "Call Method",
    editorType: "control",
    category: "構造体・クラス",
    description:
      "クラスインスタンスのメソッドを呼び出します。メソッド本文ではselfとargsを使用できます。",
    inputs: [
      input("instance", "Instance", "object"),
      input("method", "Method", "string"),
      input("args", "Args", "array"),
    ],
    outputs: [output("result", "Result")],
    defaultProperties: common,
  },


  "functional.map": {
    languageType: "functional.map",
    title: "Map",
    editorType: "operation",
    category: "関数型",
    description:
      "配列の各要素へFlow関数を適用し、新しい配列を返します。元の配列は変更しません。",
    inputs: [
      input("array", "Array", "array"),
      input("function", "Function", "object"),
    ],
    outputs: [output("result", "Result", "array")],
    defaultProperties: common,
  },

  "functional.filter": {
    languageType: "functional.filter",
    title: "Filter",
    editorType: "operation",
    category: "関数型",
    description:
      "Flow関数がTrueを返した要素だけを含む新しい配列を返します。",
    inputs: [
      input("array", "Array", "array"),
      input("predicate", "Predicate", "object"),
    ],
    outputs: [output("result", "Result", "array")],
    defaultProperties: common,
  },

  "functional.reduce": {
    languageType: "functional.reduce",
    title: "Reduce",
    editorType: "operation",
    category: "関数型",
    description:
      "AccumulatorとValueを受け取るFlow関数で配列を1つの値へ集約します。",
    inputs: [
      input("array", "Array", "array"),
      input("function", "Function", "object"),
      input("initial", "Initial"),
    ],
    outputs: [output("result", "Result")],
    defaultProperties: common,
  },

  "functional.flat_map": {
    languageType: "functional.flat_map",
    title: "Flat Map",
    editorType: "operation",
    category: "関数型",
    description:
      "各要素を配列へ変換し、結果を1階層だけ平坦化します。",
    inputs: [
      input("array", "Array", "array"),
      input("function", "Function", "object"),
    ],
    outputs: [output("result", "Result", "array")],
    defaultProperties: common,
  },

  "functional.find": {
    languageType: "functional.find",
    title: "Find",
    editorType: "operation",
    category: "関数型",
    description:
      "条件を最初に満たす要素をOptionとして返します。",
    inputs: [
      input("array", "Array", "array"),
      input("predicate", "Predicate", "object"),
    ],
    outputs: [output("option", "Option", "object")],
    defaultProperties: common,
  },

  "functional.some": {
    languageType: "functional.some",
    title: "Some / Any",
    editorType: "operation",
    category: "関数型",
    description:
      "条件を満たす要素が1つでも存在するか判定します。",
    inputs: [
      input("array", "Array", "array"),
      input("predicate", "Predicate", "object"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "functional.every": {
    languageType: "functional.every",
    title: "Every / All",
    editorType: "operation",
    category: "関数型",
    description:
      "すべての要素が条件を満たすか判定します。",
    inputs: [
      input("array", "Array", "array"),
      input("predicate", "Predicate", "object"),
    ],
    outputs: [output("result", "Result", "boolean")],
    defaultProperties: common,
  },

  "iterator.from_array": {
    languageType: "iterator.from_array",
    title: "Iterator From Array",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "配列を遅延評価Iteratorへ変換します。要素はNextまたはCollectまで処理されません。",
    inputs: [input("array", "Array", "array")],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "iterator.range": {
    languageType: "iterator.range",
    title: "Range Iterator",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "StartからEnd未満までStep刻みで値を生成する遅延Iteratorです。",
    inputs: [
      input("start", "Start", "number"),
      input("end", "End", "number"),
      input("step", "Step", "number", false),
    ],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "iterator.map": {
    languageType: "iterator.map",
    title: "Lazy Map",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "IteratorへMap処理を追加します。実際の関数呼び出しはNext/Collect時まで遅延されます。",
    inputs: [
      input("iterator", "Iterator", "object"),
      input("function", "Function", "object"),
    ],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "iterator.filter": {
    languageType: "iterator.filter",
    title: "Lazy Filter",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "IteratorへFilter条件を追加します。評価はNext/Collect時に行われます。",
    inputs: [
      input("iterator", "Iterator", "object"),
      input("predicate", "Predicate", "object"),
    ],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "iterator.take": {
    languageType: "iterator.take",
    title: "Take",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "Iteratorから先頭Count件だけを取り出す遅延制限を追加します。",
    inputs: [
      input("iterator", "Iterator", "object"),
      input("count", "Count", "number"),
    ],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "iterator.skip": {
    languageType: "iterator.skip",
    title: "Skip",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "Iteratorの先頭Count件を遅延的に読み飛ばします。",
    inputs: [
      input("iterator", "Iterator", "object"),
      input("count", "Count", "number"),
    ],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "iterator.next": {
    languageType: "iterator.next",
    title: "Iterator Next",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "次の1要素をOptionで返し、残りを新しいIteratorとして返します。",
    inputs: [input("iterator", "Iterator", "object")],
    outputs: [
      output("option", "Value", "object"),
      output("rest", "Rest", "object"),
    ],
    defaultProperties: common,
  },

  "iterator.collect": {
    languageType: "iterator.collect",
    title: "Collect Iterator",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "Iteratorを評価して配列へ収集します。Limitで無限または巨大な生成を防止します。",
    inputs: [
      input("iterator", "Iterator", "object"),
      input("limit", "Limit", "number", false),
    ],
    outputs: [output("array", "Array", "array")],
    defaultProperties: {
      ...common,
      iteratorLimit: 10000,
    },
  },

  "iterator.enumerate": {
    languageType: "iterator.enumerate",
    title: "Enumerate",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "各要素を{ index, value }形式へ遅延変換します。",
    inputs: [input("iterator", "Iterator", "object")],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "iterator.zip": {
    languageType: "iterator.zip",
    title: "Zip Iterators",
    editorType: "collection",
    category: "Iterator・遅延評価",
    description:
      "2つのIteratorを[first, second]のペアへ結合します。短い側が終了すると停止します。",
    inputs: [
      input("first", "First", "object"),
      input("second", "Second", "object"),
    ],
    outputs: [output("iterator", "Iterator", "object")],
    defaultProperties: common,
  },

  "generator.create": {
    languageType: "generator.create",
    title: "Create Generator",
    editorType: "collection",
    category: "Generator",
    description:
      "Indexを引数に受け取るFlow関数から遅延Generatorを作ります。停止条件はTakeまたはCollect Limitで指定します。",
    inputs: [
      input("function", "Function", "object"),
      input("startIndex", "Start Index", "number", false),
    ],
    outputs: [output("generator", "Generator", "object")],
    defaultProperties: {
      ...common,
      generatorStartIndex: 0,
    },
  },

  "generator.next": {
    languageType: "generator.next",
    title: "Generator Next",
    editorType: "collection",
    category: "Generator",
    description:
      "Generatorから次の値と、次状態のGeneratorを返します。",
    inputs: [input("generator", "Generator", "object")],
    outputs: [
      output("value", "Value"),
      output("next", "Next", "object"),
    ],
    defaultProperties: common,
  },

  "generator.collect": {
    languageType: "generator.collect",
    title: "Collect Generator",
    editorType: "collection",
    category: "Generator",
    description:
      "GeneratorをLimit件だけ評価して配列へ収集します。",
    inputs: [
      input("generator", "Generator", "object"),
      input("limit", "Limit", "number"),
    ],
    outputs: [output("array", "Array", "array")],
    defaultProperties: common,
  },


  "async.delay": {
    languageType: "async.delay",
    title: "Delay Promise",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "指定ミリ秒後にValueで解決するPromiseを作成します。処理自体は待機せず、Awaitで明示的に待てます。",
    inputs: [
      input("value", "Value"),
      input("milliseconds", "Milliseconds", "number"),
    ],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: common,
  },

  "async.task_from_function": {
    languageType: "async.task_from_function",
    title: "Start Async Task",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "Flow関数をバックグラウンドタスクとして開始し、待機可能なPromise値を返します。",
    inputs: [
      input("function", "Function", "object"),
      input("args", "Args", "array"),
    ],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: common,
  },

  "async.await": {
    languageType: "async.await",
    title: "Await",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "PromiseまたはTaskの完了を待ち、解決値を返します。通常値を接続した場合はそのまま返します。",
    inputs: [input("promise", "Promise")],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "async.promise_all": {
    languageType: "async.promise_all",
    title: "Promise All",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "Promise配列がすべて完了するのを待つPromiseを作ります。結果の順序は入力順です。",
    inputs: [input("promises", "Promises", "array")],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: common,
  },

  "async.promise_race": {
    languageType: "async.promise_race",
    title: "Promise Race",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "Promise配列のうち最初に完了または失敗した結果を返すPromiseを作ります。",
    inputs: [input("promises", "Promises", "array")],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: common,
  },

  "async.timeout": {
    languageType: "async.timeout",
    title: "Promise Timeout",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "Promiseが指定時間内に完了しなければタイムアウトエラーにする新しいPromiseを返します。",
    inputs: [
      input("promise", "Promise"),
      input("milliseconds", "Milliseconds", "number"),
    ],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: {
      ...common,
      timeoutMs: 5000,
    },
  },

  "async.retry": {
    languageType: "async.retry",
    title: "Retry Async Function",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "Flow関数が失敗した場合に指定回数まで再試行するPromiseを作ります。",
    inputs: [
      input("function", "Function", "object"),
      input("args", "Args", "array"),
      input("retries", "Retries", "number", false),
      input("delayMs", "Delay", "number", false),
    ],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: {
      ...common,
      retryCount: 3,
      retryDelayMs: 250,
    },
  },

  "async.status": {
    languageType: "async.status",
    title: "Promise Status",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "Promiseの状態をpending、fulfilled、rejected、cancelledの文字列で返します。",
    inputs: [input("promise", "Promise")],
    outputs: [output("status", "Status", "string")],
    defaultProperties: common,
  },

  "async.cancel": {
    languageType: "async.cancel",
    title: "Cancel Task",
    editorType: "control",
    category: "非同期・Promise",
    description:
      "キャンセル可能なTaskへキャンセル要求を送ります。任意の外部処理を強制停止できるわけではありません。",
    inputs: [input("promise", "Promise")],
    outputs: [output("cancelled", "Cancelled", "boolean")],
    defaultProperties: common,
  },

  "async.parallel_map": {
    languageType: "async.parallel_map",
    title: "Parallel Map",
    editorType: "control",
    category: "非同期・並行処理",
    description:
      "配列の各要素へ非同期Flow関数を並行適用します。Concurrencyで同時実行数を制限できます。",
    inputs: [
      input("array", "Array", "array"),
      input("function", "Function", "object"),
      input("concurrency", "Concurrency", "number", false),
    ],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: {
      ...common,
      concurrency: 4,
    },
  },

  "async.parallel_filter": {
    languageType: "async.parallel_filter",
    title: "Parallel Filter",
    editorType: "control",
    category: "非同期・並行処理",
    description:
      "非同期条件関数を並行実行し、Trueになった要素だけを入力順で返すPromiseを作ります。",
    inputs: [
      input("array", "Array", "array"),
      input("predicate", "Predicate", "object"),
      input("concurrency", "Concurrency", "number", false),
    ],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: {
      ...common,
      concurrency: 4,
    },
  },

  "async.parallel_invoke": {
    languageType: "async.parallel_invoke",
    title: "Run Functions In Parallel",
    editorType: "control",
    category: "非同期・並行処理",
    description:
      "Flow関数の配列を同時に開始し、すべての結果を返すPromiseを作ります。",
    inputs: [
      input("functions", "Functions", "array"),
      input("args", "Shared Args", "array", false),
    ],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: common,
  },

  "coroutine.create": {
    languageType: "coroutine.create",
    title: "Create Coroutine",
    editorType: "control",
    category: "コルーチン",
    description:
      "Flow関数を協調実行可能なCoroutineへ変換します。関数は(index, input, state)を受け取ります。",
    inputs: [
      input("function", "Function", "object"),
      input("initialState", "Initial State", "any", false),
    ],
    outputs: [output("coroutine", "Coroutine", "object")],
    defaultProperties: {
      ...common,
      coroutineInitialState: null,
    },
  },

  "coroutine.resume": {
    languageType: "coroutine.resume",
    title: "Resume Coroutine",
    editorType: "control",
    category: "コルーチン",
    description:
      "Coroutineを1ステップ進めます。関数は{ value, state, done }または通常値を返せます。",
    inputs: [
      input("coroutine", "Coroutine", "object"),
      input("input", "Input", "any", false),
    ],
    outputs: [
      output("value", "Value"),
      output("next", "Next", "object"),
      output("done", "Done", "boolean"),
    ],
    defaultProperties: common,
  },

  "coroutine.collect": {
    languageType: "coroutine.collect",
    title: "Collect Coroutine",
    editorType: "control",
    category: "コルーチン",
    description:
      "Coroutineを完了またはLimit回まで再開し、yieldされた値を配列へ収集します。",
    inputs: [
      input("coroutine", "Coroutine", "object"),
      input("limit", "Limit", "number"),
    ],
    outputs: [
      output("values", "Values", "array"),
      output("next", "Next", "object"),
      output("done", "Done", "boolean"),
    ],
    defaultProperties: common,
  },

  "coroutine.status": {
    languageType: "coroutine.status",
    title: "Coroutine Status",
    editorType: "control",
    category: "コルーチン",
    description:
      "Coroutineの状態をsuspendedまたはdoneで返します。",
    inputs: [input("coroutine", "Coroutine", "object")],
    outputs: [output("status", "Status", "string")],
    defaultProperties: common,
  },

  "channel.create": {
    languageType: "channel.create",
    title: "Create Channel",
    editorType: "control",
    category: "チャネル・同期",
    description:
      "非同期タスク間で値を送受信するChannelを作成します。Capacityが0以下なら無制限キューです。",
    inputs: [input("capacity", "Capacity", "number", false)],
    outputs: [output("channel", "Channel", "object")],
    defaultProperties: {
      ...common,
      channelCapacity: 0,
    },
  },

  "channel.send": {
    languageType: "channel.send",
    title: "Channel Send",
    editorType: "control",
    category: "チャネル・同期",
    description:
      "Channelへ値を送信します。受信待ちがあれば直接渡し、なければキューへ追加します。",
    inputs: [
      input("channel", "Channel", "object"),
      input("value", "Value"),
    ],
    outputs: [
      output("channel", "Channel", "object"),
      output("sent", "Sent", "boolean"),
    ],
    defaultProperties: common,
  },

  "channel.receive": {
    languageType: "channel.receive",
    title: "Channel Receive",
    editorType: "control",
    category: "チャネル・同期",
    description:
      "Channelから次の値を受け取るPromiseを作ります。値がなければ送信されるまで待機します。",
    inputs: [input("channel", "Channel", "object")],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: common,
  },

  "channel.try_receive": {
    languageType: "channel.try_receive",
    title: "Channel Try Receive",
    editorType: "control",
    category: "チャネル・同期",
    description:
      "待機せずChannelから値を取得し、Optionとして返します。",
    inputs: [input("channel", "Channel", "object")],
    outputs: [
      output("option", "Value", "object"),
      output("channel", "Channel", "object"),
    ],
    defaultProperties: common,
  },

  "channel.close": {
    languageType: "channel.close",
    title: "Close Channel",
    editorType: "control",
    category: "チャネル・同期",
    description:
      "Channelを閉じ、待機中の受信処理をエラーで終了させます。",
    inputs: [input("channel", "Channel", "object")],
    outputs: [output("closed", "Closed", "boolean")],
    defaultProperties: common,
  },


  "network.http_request": {
    languageType: "network.http_request",
    title: "HTTP Request",
    editorType: "control",
    category: "ネットワーク/HTTP",
    description:
      "RustバックエンドからHTTP/HTTPSリクエストを送信します。CORSの影響を受けません。",
    inputs: [
      input("url", "URL", "string"),
      input("method", "Method", "string", false),
      input("headers", "Headers", "object", false),
      input("body", "Body", "any", false),
      input("timeoutMs", "Timeout", "number", false),
    ],
    outputs: [
      output("status", "Status", "number"),
      output("headers", "Headers", "object"),
      output("body", "Body", "string"),
      output("json", "JSON", "any"),
    ],
    defaultProperties: {
      ...common,
      httpMethod: "GET",
      httpTimeoutMs: 15000,
    },
  },

  "network.websocket_connect": {
    languageType: "network.websocket_connect",
    title: "WebSocket Connect",
    editorType: "control",
    category: "ネットワーク/WebSocket",
    description:
      "WebSocketへ接続し、送受信ノードで利用する接続オブジェクトを返します。",
    inputs: [input("url", "URL", "string")],
    outputs: [output("socket", "Socket", "object")],
    defaultProperties: common,
  },

  "network.websocket_send": {
    languageType: "network.websocket_send",
    title: "WebSocket Send",
    editorType: "control",
    category: "ネットワーク/WebSocket",
    description: "WebSocket接続へ文字列またはJSON値を送信します。",
    inputs: [
      input("socket", "Socket", "object"),
      input("message", "Message"),
    ],
    outputs: [
      output("socket", "Socket", "object"),
      output("sent", "Sent", "boolean"),
    ],
    defaultProperties: common,
  },

  "network.websocket_receive": {
    languageType: "network.websocket_receive",
    title: "WebSocket Receive",
    editorType: "control",
    category: "ネットワーク/WebSocket",
    description:
      "WebSocketの次のメッセージを受信するPromiseを返します。Awaitへ接続してください。",
    inputs: [input("socket", "Socket", "object")],
    outputs: [output("promise", "Promise", "object")],
    defaultProperties: common,
  },

  "network.websocket_close": {
    languageType: "network.websocket_close",
    title: "WebSocket Close",
    editorType: "control",
    category: "ネットワーク/WebSocket",
    description: "WebSocket接続を閉じます。",
    inputs: [input("socket", "Socket", "object")],
    outputs: [output("closed", "Closed", "boolean")],
    defaultProperties: common,
  },

  "network.tcp_request": {
    languageType: "network.tcp_request",
    title: "TCP Request",
    editorType: "control",
    category: "ネットワーク/TCP・UDP",
    description:
      "指定ホストへTCP接続し、データを送信して応答を読み取ります。",
    inputs: [
      input("host", "Host", "string"),
      input("port", "Port", "number"),
      input("data", "Data", "string"),
      input("timeoutMs", "Timeout", "number", false),
    ],
    outputs: [output("response", "Response", "string")],
    defaultProperties: {
      ...common,
      networkTimeoutMs: 5000,
    },
  },

  "network.udp_request": {
    languageType: "network.udp_request",
    title: "UDP Request",
    editorType: "control",
    category: "ネットワーク/TCP・UDP",
    description:
      "UDPデータグラムを送信し、任意で1件の応答を待ちます。",
    inputs: [
      input("host", "Host", "string"),
      input("port", "Port", "number"),
      input("data", "Data", "string"),
      input("timeoutMs", "Timeout", "number", false),
    ],
    outputs: [output("response", "Response", "string")],
    defaultProperties: {
      ...common,
      networkTimeoutMs: 3000,
    },
  },

  "parse.json_parse": {
    languageType: "parse.json_parse",
    title: "Parse JSON",
    editorType: "operation",
    category: "解析/JSON・XML",
    description: "JSON文字列を配列またはオブジェクトへ変換します。",
    inputs: [input("text", "Text", "string")],
    outputs: [output("value", "Value")],
    defaultProperties: common,
  },

  "parse.json_stringify": {
    languageType: "parse.json_stringify",
    title: "Stringify JSON",
    editorType: "operation",
    category: "解析/JSON・XML",
    description: "値をJSON文字列へ変換します。",
    inputs: [
      input("value", "Value"),
      input("pretty", "Pretty", "boolean", false),
    ],
    outputs: [output("text", "Text", "string")],
    defaultProperties: common,
  },

  "parse.xml_parse": {
    languageType: "parse.xml_parse",
    title: "Parse XML",
    editorType: "operation",
    category: "解析/JSON・XML",
    description:
      "XML文字列を簡易オブジェクトへ変換します。属性は@attributes、文字は#textに格納します。",
    inputs: [input("text", "Text", "string")],
    outputs: [output("value", "Value", "object")],
    defaultProperties: common,
  },

  "parse.html_select": {
    languageType: "parse.html_select",
    title: "HTML Select",
    editorType: "operation",
    category: "解析/スクレイピング",
    description:
      "HTML文字列からCSSセレクターに一致する要素の文字列と属性を抽出します。",
    inputs: [
      input("html", "HTML", "string"),
      input("selector", "Selector", "string"),
    ],
    outputs: [output("elements", "Elements", "array")],
    defaultProperties: common,
  },

  "stream.from_text": {
    languageType: "stream.from_text",
    title: "Text Stream",
    editorType: "collection",
    category: "ストリーム処理",
    description:
      "文字列を指定サイズのチャンクとして遅延処理できるStreamへ変換します。",
    inputs: [
      input("text", "Text", "string"),
      input("chunkSize", "Chunk Size", "number", false),
    ],
    outputs: [output("stream", "Stream", "object")],
    defaultProperties: {
      ...common,
      streamChunkSize: 4096,
    },
  },

  "stream.lines": {
    languageType: "stream.lines",
    title: "Line Stream",
    editorType: "collection",
    category: "ストリーム処理",
    description: "文字列を行単位のStreamへ変換します。",
    inputs: [input("text", "Text", "string")],
    outputs: [output("stream", "Stream", "object")],
    defaultProperties: common,
  },

  "stream.map": {
    languageType: "stream.map",
    title: "Stream Map",
    editorType: "collection",
    category: "ストリーム処理",
    description: "Streamの各チャンクへFlow関数を遅延適用します。",
    inputs: [
      input("stream", "Stream", "object"),
      input("function", "Function", "object"),
    ],
    outputs: [output("stream", "Stream", "object")],
    defaultProperties: common,
  },

  "stream.filter": {
    languageType: "stream.filter",
    title: "Stream Filter",
    editorType: "collection",
    category: "ストリーム処理",
    description: "条件関数がTrueを返すチャンクだけを残します。",
    inputs: [
      input("stream", "Stream", "object"),
      input("predicate", "Predicate", "object"),
    ],
    outputs: [output("stream", "Stream", "object")],
    defaultProperties: common,
  },

  "stream.collect": {
    languageType: "stream.collect",
    title: "Collect Stream",
    editorType: "collection",
    category: "ストリーム処理",
    description: "Streamを指定上限まで評価して配列へ収集します。",
    inputs: [
      input("stream", "Stream", "object"),
      input("limit", "Limit", "number", false),
    ],
    outputs: [output("array", "Array", "array")],
    defaultProperties: common,
  },

  "stream.join": {
    languageType: "stream.join",
    title: "Join Stream",
    editorType: "collection",
    category: "ストリーム処理",
    description: "Streamを評価し、区切り文字で結合した文字列を返します。",
    inputs: [
      input("stream", "Stream", "object"),
      input("separator", "Separator", "string", false),
      input("limit", "Limit", "number", false),
    ],
    outputs: [output("text", "Text", "string")],
    defaultProperties: common,
  },

  "cache.set": {
    languageType: "cache.set",
    title: "Cache Set",
    editorType: "control",
    category: "キャッシュ",
    description:
      "実行中のメモリキャッシュへ値を保存します。TTLが0以下なら期限なしです。",
    inputs: [
      input("key", "Key", "string"),
      input("value", "Value"),
      input("ttlMs", "TTL ms", "number", false),
    ],
    outputs: [output("value", "Value")],
    defaultProperties: {
      ...common,
      cacheTtlMs: 0,
    },
  },

  "cache.get": {
    languageType: "cache.get",
    title: "Cache Get",
    editorType: "control",
    category: "キャッシュ",
    description: "キャッシュ値をOptionとして取得します。",
    inputs: [input("key", "Key", "string")],
    outputs: [output("option", "Option", "object")],
    defaultProperties: common,
  },

  "cache.delete": {
    languageType: "cache.delete",
    title: "Cache Delete",
    editorType: "control",
    category: "キャッシュ",
    description: "指定キーをキャッシュから削除します。",
    inputs: [input("key", "Key", "string")],
    outputs: [output("deleted", "Deleted", "boolean")],
    defaultProperties: common,
  },

  "cache.clear": {
    languageType: "cache.clear",
    title: "Cache Clear",
    editorType: "control",
    category: "キャッシュ",
    description: "実行中のメモリキャッシュをすべて削除します。",
    inputs: [],
    outputs: [output("cleared", "Cleared", "boolean")],
    defaultProperties: common,
  },

  "database.sqlite_execute": {
    languageType: "database.sqlite_execute",
    title: "SQLite Execute",
    editorType: "control",
    category: "データベース/SQLite",
    description:
      "SQLiteデータベースでCREATE、INSERT、UPDATE、DELETEなどを実行します。",
    inputs: [
      input("path", "Database Path", "string"),
      input("sql", "SQL", "string"),
      input("params", "Params", "array", false),
    ],
    outputs: [output("affected", "Affected", "number")],
    defaultProperties: common,
  },

  "database.sqlite_query": {
    languageType: "database.sqlite_query",
    title: "SQLite Query",
    editorType: "control",
    category: "データベース/SQLite",
    description: "SQLite SELECT結果をオブジェクト配列として返します。",
    inputs: [
      input("path", "Database Path", "string"),
      input("sql", "SQL", "string"),
      input("params", "Params", "array", false),
    ],
    outputs: [output("rows", "Rows", "array")],
    defaultProperties: common,
  },

  "database.orm_select": {
    languageType: "database.orm_select",
    title: "ORM Select Builder",
    editorType: "object",
    category: "データベース/ORM",
    description:
      "テーブル、列、条件から安全なSELECT文とパラメーターを組み立てます。",
    inputs: [
      input("table", "Table", "string"),
      input("columns", "Columns", "array", false),
      input("where", "Where", "object", false),
      input("limit", "Limit", "number", false),
    ],
    outputs: [output("query", "Query", "object")],
    defaultProperties: common,
  },

  "database.orm_insert": {
    languageType: "database.orm_insert",
    title: "ORM Insert Builder",
    editorType: "object",
    category: "データベース/ORM",
    description: "テーブルとデータオブジェクトからINSERT文を生成します。",
    inputs: [
      input("table", "Table", "string"),
      input("data", "Data", "object"),
    ],
    outputs: [output("query", "Query", "object")],
    defaultProperties: common,
  },

  "database.orm_update": {
    languageType: "database.orm_update",
    title: "ORM Update Builder",
    editorType: "object",
    category: "データベース/ORM",
    description: "更新データと条件からUPDATE文を生成します。",
    inputs: [
      input("table", "Table", "string"),
      input("data", "Data", "object"),
      input("where", "Where", "object"),
    ],
    outputs: [output("query", "Query", "object")],
    defaultProperties: common,
  },

  "database.query_sql": {
    languageType: "database.query_sql",
    title: "Query SQL",
    editorType: "object",
    category: "データベース/ORM",
    description: "ORM QueryオブジェクトからSQL文字列を取得します。",
    inputs: [input("query", "Query", "object")],
    outputs: [
      output("sql", "SQL", "string"),
      output("params", "Params", "array"),
    ],
    defaultProperties: common,
  },

  "crypto.sha256": {
    languageType: "crypto.sha256",
    title: "SHA-256",
    editorType: "operation",
    category: "セキュリティ/ハッシュ",
    description: "文字列または値をSHA-256でハッシュ化し16進文字列を返します。",
    inputs: [input("value", "Value")],
    outputs: [output("hash", "Hash", "string")],
    defaultProperties: common,
  },

  "crypto.hmac_sha256": {
    languageType: "crypto.hmac_sha256",
    title: "HMAC SHA-256",
    editorType: "operation",
    category: "セキュリティ/ハッシュ",
    description: "秘密鍵を使ってHMAC-SHA256署名を生成します。",
    inputs: [
      input("value", "Value"),
      input("secret", "Secret", "string"),
    ],
    outputs: [output("signature", "Signature", "string")],
    defaultProperties: common,
  },

  "crypto.random_bytes": {
    languageType: "crypto.random_bytes",
    title: "Random Bytes",
    editorType: "operation",
    category: "セキュリティ/暗号",
    description: "暗号学的乱数をBase64文字列で生成します。",
    inputs: [input("length", "Length", "number")],
    outputs: [output("base64", "Base64", "string")],
    defaultProperties: common,
  },

  "crypto.aes_encrypt": {
    languageType: "crypto.aes_encrypt",
    title: "AES-GCM Encrypt",
    editorType: "operation",
    category: "セキュリティ/暗号",
    description:
      "秘密文字列からSHA-256鍵を導出し、AES-GCMで暗号化します。結果はBase64です。",
    inputs: [
      input("text", "Text", "string"),
      input("secret", "Secret", "string"),
    ],
    outputs: [output("encrypted", "Encrypted", "string")],
    defaultProperties: common,
  },

  "crypto.aes_decrypt": {
    languageType: "crypto.aes_decrypt",
    title: "AES-GCM Decrypt",
    editorType: "operation",
    category: "セキュリティ/暗号",
    description: "AES-GCM Encryptノードの出力を復号します。",
    inputs: [
      input("encrypted", "Encrypted", "string"),
      input("secret", "Secret", "string"),
    ],
    outputs: [output("text", "Text", "string")],
    defaultProperties: common,
  },

  "crypto.jwt_sign": {
    languageType: "crypto.jwt_sign",
    title: "JWT Sign HS256",
    editorType: "operation",
    category: "セキュリティ/JWT",
    description: "PayloadオブジェクトをHS256 JWTとして署名します。",
    inputs: [
      input("payload", "Payload", "object"),
      input("secret", "Secret", "string"),
    ],
    outputs: [output("token", "Token", "string")],
    defaultProperties: common,
  },

  "crypto.jwt_verify": {
    languageType: "crypto.jwt_verify",
    title: "JWT Verify HS256",
    editorType: "operation",
    category: "セキュリティ/JWT",
    description: "HS256 JWTの署名を検証し、結果とPayloadを返します。",
    inputs: [
      input("token", "Token", "string"),
      input("secret", "Secret", "string"),
    ],
    outputs: [
      output("valid", "Valid", "boolean"),
      output("payload", "Payload", "object"),
    ],
    defaultProperties: common,
  },

  "gpu.webgpu_available": {
    languageType: "gpu.webgpu_available",
    title: "WebGPU Available",
    editorType: "operation",
    category: "GPU",
    description: "現在のWebViewでWebGPUが使用可能か判定します。",
    inputs: [],
    outputs: [output("available", "Available", "boolean")],
    defaultProperties: common,
  },

  "gpu.vector_add": {
    languageType: "gpu.vector_add",
    title: "GPU Vector Add",
    editorType: "operation",
    category: "GPU",
    description:
      "WebGPUが利用可能ならGPU Computeで、利用できなければCPUで2つの数値配列を加算します。",
    inputs: [
      input("a", "A", "array"),
      input("b", "B", "array"),
    ],
    outputs: [
      output("result", "Result", "array"),
      output("backend", "Backend", "string"),
    ],
    defaultProperties: common,
  },


  "gui.window": {
    languageType: "gui.window",
    title: "GUI Window",
    editorType: "object",
    category: "GUI Designer",
    description:
      "GUIコンポーネントを単体ウィンドウとして表示するWindow仕様を作成します。",
    inputs: [
      input("title", "Title", "string"),
      input("content", "Content", "object"),
      input("width", "Width", "number", false),
      input("height", "Height", "number", false),
    ],
    outputs: [output("window", "Window", "object")],
    defaultProperties: common,
  },

  "gui.label": {
    languageType: "gui.label",
    title: "GUI Label",
    editorType: "object",
    category: "GUI Designer",
    description: "文字を表示するLabelコンポーネントを作成します。",
    inputs: [input("text", "Text", "string")],
    outputs: [output("component", "Component", "object")],
    defaultProperties: common,
  },

  "gui.button": {
    languageType: "gui.button",
    title: "GUI Button",
    editorType: "object",
    category: "GUI Designer",
    description:
      "クリック可能なButton仕様を作成します。現在はクリック回数を内部表示します。",
    inputs: [input("text", "Text", "string")],
    outputs: [output("component", "Component", "object")],
    defaultProperties: common,
  },

  "gui.input": {
    languageType: "gui.input",
    title: "GUI Text Input",
    editorType: "object",
    category: "GUI Designer",
    description: "編集可能なテキスト入力コンポーネントを作成します。",
    inputs: [
      input("placeholder", "Placeholder", "string", false),
      input("value", "Value", "string", false),
    ],
    outputs: [output("component", "Component", "object")],
    defaultProperties: common,
  },

  "gui.row": {
    languageType: "gui.row",
    title: "GUI Row",
    editorType: "object",
    category: "GUI Designer",
    description: "コンポーネント配列を横方向に並べます。",
    inputs: [input("children", "Children", "array")],
    outputs: [output("component", "Component", "object")],
    defaultProperties: common,
  },

  "gui.column": {
    languageType: "gui.column",
    title: "GUI Column",
    editorType: "object",
    category: "GUI Designer",
    description: "コンポーネント配列を縦方向に並べます。",
    inputs: [input("children", "Children", "array")],
    outputs: [output("component", "Component", "object")],
    defaultProperties: common,
  },

  "gui.show": {
    languageType: "gui.show",
    title: "Show GUI",
    editorType: "output",
    category: "GUI Designer",
    description:
      "GUI Window仕様をFlow Language内の独立したGUIウィンドウとして表示します。",
    inputs: [input("window", "Window", "object")],
    outputs: [output("windowId", "Window ID", "string")],
    defaultProperties: common,
  },

"string.concat": {
  languageType: "string.concat",
  title: "Concat",
  editorType: "operation",
  category: "文字列",
  description: "AとBを文字列として連結します。",
  inputs: [
    input("a", "A", "string"),
    input("b", "B", "string"),
  ],
  outputs: [output("result", "Result", "string")],
  defaultProperties: common,
},

"string.uppercase": {
  languageType: "string.uppercase",
  title: "Uppercase",
  editorType: "operation",
  category: "文字列",
  description: "文字列を大文字へ変換します。",
  inputs: [input("value", "Value", "string")],
  outputs: [output("result", "Result", "string")],
  defaultProperties: common,
},

"string.trim": {
  languageType: "string.trim",
  title: "Trim",
  editorType: "operation",
  category: "文字列",
  description: "文字列の前後にある空白を削除します。",
  inputs: [input("value", "Value", "string")],
  outputs: [output("result", "Result", "string")],
  defaultProperties: common,
},

"array.push": {
  languageType: "array.push",
  title: "Array Push",
  editorType: "collection",
  category: "配列",
  description:
    "元の配列を変更せず、末尾にValueを追加した新しい配列を返します。",
  inputs: [
    input("array", "Array", "array"),
    input("value", "Value"),
  ],
  outputs: [output("result", "Result", "array")],
  defaultProperties: common,
},

  "core.print": {
    languageType: "core.print",
    title: "Print",
    editorType: "output",
    category: "出力",
    description:
      "入力値を実行ログへ出力します。実行順序はPrint同士で重複しません。",
    inputs: [input("input", "Input")],
    outputs: [],
    defaultProperties: {
      ...common,
      executionOrder: 0,
    },
  },
};

export function createDefinitionMap(
  plugins: PluginManifest[],
): Record<string, NodeDefinition> {
  const definitions = {
    ...BUILTIN_NODE_DEFINITIONS,
  };

  for (const plugin of plugins) {
    if (plugin.enabled === false) {
      continue;
    }

    for (const node of plugin.nodes) {
      definitions[node.languageType] =
        pluginDefinition(node);
    }
  }

  return definitions;
}

function pluginDefinition(
  node: PluginNodeDefinition,
): NodeDefinition {
  return {
    ...node,
    editorType: "plugin",
    description:
      node.description ??
      `${node.languageType}プラグインノード`,
    defaultProperties: {
      parallel: false,
      breakpoint: false,
      ...node.defaultProperties,
    },
  };
}
