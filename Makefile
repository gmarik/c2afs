IMG=c2a:dev
RUN=docker run --rm -it -v ${PWD}:/app --workdir=/app $(IMG)

dev: build
	$(RUN) nodemon --watch "src/*.ts" --ext "ts,json" --ignore "src/**/*.spec.ts" --exec "ts-node src/*.ts"

.PHONY: shell
shell:
	 $(RUN) /bin/bash

.PHONY: build
build: BUILD=docker build -t $(IMG) -f dev.Dockerfile .
build:
	$(BUILD)

