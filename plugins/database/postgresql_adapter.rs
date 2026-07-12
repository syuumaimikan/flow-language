use std::io::{self, Read};

fn main() {
    let mut input = String::new();

    if let Err(error) = io::stdin().read_to_string(&mut input) {
        eprintln!("{error}");
        std::process::exit(1);
    }

    // 実用版ではpostgresクレートで接続し、inputs.connection / sql / paramsを処理します。
    println!(
        "{{\"rows\":[{{\"adapter\":\"postgresql\",\"receivedLength\":{}}}]}}",
        input.len()
    );
}
