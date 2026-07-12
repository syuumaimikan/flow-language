import json
import sys

payload = json.load(sys.stdin)
json.dump(
    {
        "result": {
            "language": "python",
            "payload": payload,
        }
    },
    sys.stdout,
    ensure_ascii=False,
)
