#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo 'Please install Node.js 22.12 or later first. / 请先安装 Node.js 22.12 或更新版本。'
  read '?Press Enter to close / 按回车关闭'
  exit 1
fi
if [[ ! -d node_modules ]]; then npm ci; fi
echo 'Open http://127.0.0.1:5181 in your browser. / 请在浏览器中打开 http://127.0.0.1:5181'
echo 'Stop with Control+C. / 按 Control+C 停止。'
npm run dev
