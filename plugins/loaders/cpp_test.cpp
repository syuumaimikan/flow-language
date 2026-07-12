#include <iostream>
#include <iterator>
#include <string>

int main() {
    const std::string input{
        std::istreambuf_iterator<char>{std::cin},
        std::istreambuf_iterator<char>{}
    };

    std::cout
        << "{\"result\":{\"language\":\"cpp\",\"receivedLength\":"
        << input.size()
        << "}}";

    return 0;
}
