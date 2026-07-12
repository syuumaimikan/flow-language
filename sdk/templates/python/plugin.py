import json
import sys

def main() -> None:
    payload = json.load(sys.stdin)
    value = payload.get("inputs", {}).get("value")

    json.dump(
        {
            "result": {
                "language": "python",
                "value": value,
            }
        },
        sys.stdout,
        ensure_ascii=False,
    )

if __name__ == "__main__":
    main()
