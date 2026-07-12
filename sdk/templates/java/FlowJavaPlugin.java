import java.io.IOException;
import java.nio.charset.StandardCharsets;

public final class FlowJavaPlugin {
    public static void main(String[] args) throws IOException {
        String input = new String(
            System.in.readAllBytes(),
            StandardCharsets.UTF_8
        );

        String escaped = input
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
