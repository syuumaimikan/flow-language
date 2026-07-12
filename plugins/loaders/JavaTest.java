import java.io.IOException;
import java.nio.charset.StandardCharsets;

public final class JavaTest {
    public static void main(String[] args) throws IOException {
        String raw = new String(
            System.in.readAllBytes(),
            StandardCharsets.UTF_8
        );

        String escaped = raw
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");

        System.out.print(
            "{\"result\":{\"language\":\"java\",\"raw\":\""
                + escaped
                + "\"}}"
        );
    }
}
