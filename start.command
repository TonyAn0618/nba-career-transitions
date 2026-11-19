#!/bin/zsh
set -e
cd "$(dirname "$0")"
compatible_node() {
  "$1" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' 2>/dev/null
}
if ! compatible_node node; then
  for bin in /opt/homebrew/bin /usr/local/bin; do
    if [[ -x "$bin/node" ]] && compatible_node "$bin/node"; then
      export PATH="$bin:$PATH"
      break
    fi
  done
fi
if ! compatible_node node || ! command -v npm >/dev/null 2>&1; then
  echo 'Please install Node.js 22.12+ and npm. / 请安装 Node.js 22.12 或更新版本及 npm。'
  read '?Press Enter to close / 按回车关闭'
  exit 1
fi
if [[ ! -d node_modules ]]; then npm ci; fi
echo 'Open http://127.0.0.1:5181 in your browser. / 请在浏览器中打开 http://127.0.0.1:5181'
echo 'Stop with Control+C. / 按 Control+C 停止。'
npm run dev
