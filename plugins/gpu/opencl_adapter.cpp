#include <iostream>
#include <iterator>
#include <string>

int main() {
    const std::string input{
        std::istreambuf_iterator<char>{std::cin},
        std::istreambuf_iterator<char>{}
    };

    // 実用版ではOpenCLコンテキストとカーネルを作成します。
    std::cout
        << "{\"result\":{\"backend\":\"opencl-adapter\",\"receivedLength\":"
        << input.size()
        << "}}";

    return 0;
}
