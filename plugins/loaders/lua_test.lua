local input = io.read("*a")
-- 実運用ではJSONライブラリを使って解析してください。
io.write('{"result":{"language":"lua","received":' .. string.format("%q", input) .. '}}')
