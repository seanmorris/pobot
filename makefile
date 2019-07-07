.PHONY: build build-dev configure run run-dev clean

build:
	@ docker build -t seanmorris/pobot:latest .

build-dev:
	@ docker build --target base -t seanmorris/pobot-dev:latest .

configure:
	@  npm install

SCRIPT?=/app/example/npmSearch.js

run:
	docker run --rm \
	-e "DISPLAY=${DISPLAY}" \
	-v /tmp/.X11-unix:/tmp/.X11-unix \
	seanmorris/pobot \
		node /app/index.js $(SCRIPT)

run-dev:
	docker run --rm \
	-e "DISPLAY=${DISPLAY}" \
	-v /tmp/.X11-unix:/tmp/.X11-unix \
	-v `pwd`:/app/ \
	seanmorris/pobot \
		node /app/index.js $(SCRIPT)

clean:
	@ rm -rf node_modules package-lock.json;
