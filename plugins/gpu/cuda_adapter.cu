#include <iostream>
#include <iterator>
#include <string>

int main() {
    const std::string input{
        std::istreambuf_iterator<char>{std::cin},
        std::istreambuf_iterator<char>{}
    };

    // 実用版ではCUDAカーネルを起動してJSON結果を返します。
    std::cout
        << "{\"result\":{\"backend\":\"cuda-adapter\",\"receivedLength\":"
        << input.size()
        << "}}";

    return 0;
}
