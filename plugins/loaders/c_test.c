#include <stdio.h>

int main(void) {
    int ch;
    size_t count = 0;

    while ((ch = getchar()) != EOF) {
        count++;
    }

    printf("{\"result\":{\"language\":\"c\",\"receivedLength\":%zu}}", count);
    return 0;
}
