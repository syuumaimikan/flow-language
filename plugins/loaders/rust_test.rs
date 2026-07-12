use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();

    println!(
        "{{\"result\":{{\"language\":\"rust\",\"receivedLength\":{}}}}}",
        input.len()
    );
}
