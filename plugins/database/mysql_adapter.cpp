#include <iostream>
#include <iterator>
#include <string>

int main() {
    const std::string input{
        std::istreambuf_iterator<char>{std::cin},
        std::istreambuf_iterator<char>{}
    };

    // 実用版ではMySQL Connector/C++で接続し、JSON入力を処理します。
    std::cout
        << "{\"rows\":[{\"adapter\":\"mysql\",\"receivedLength\":"
        << input.size()
        << "}]}";

    return 0;
}
