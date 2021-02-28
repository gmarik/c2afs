IMG=c2a:dev

test: build/compiler.js
	node $<

watch:
	nodemon --watch "src/*.ts" --ext "ts,json" --ignore "src/**/*.spec.ts" --exec "ts-node src/*.ts"

build/%.js: %.ts
	tsc

.PHONY: shell
shell: RUN=docker run --rm -it -v ${PWD}:/app --workdir=/app $(IMG)
shell:
	 $(RUN) /bin/bash

.PHONY: build

build: BUILD=docker build -t $(IMG) -f dev.Dockerfile .
build:
	$(BUILD)

