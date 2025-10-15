SHELL := /bin/zsh
PORT ?= 3002
HOST ?= 127.0.0.1
dev: ; export NVM_DIR="$$HOME/.nvm"; [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"; \
  command -v nvm >/dev/null && { nvm use 20 >/dev/null || (nvm install 20 >/dev/null && nvm use 20 >/dev/null); }; \
  HOSTNAME=$(HOST) PORT=$(PORT) npm run dev

e2e:
	BASE_URL=http://127.0.0.1:3003 pnpm exec playwright test

stop:
	- lsof -ti tcp:3003 | xargs -r kill -9
