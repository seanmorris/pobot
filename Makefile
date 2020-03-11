.PHONY: build build-dev configure run run-dev clean

build:
	@ docker build -t seanmorris/pobot:latest .

build-dev:
	@ docker build --target base -t seanmorris/pobot-dev:latest .

configure:
	@  npm install

ARGS?=
SCRIPTS?=

run:
	docker run -it --rm \
	--ipc="host" \
	-e "DISPLAY=${DISPLAY}" \
	-v /tmp/.X11-unix:/tmp/.X11-unix \
	-v=${SCRIPTS}:/scripts/: \
	-v `pwd`:/work/ \
	-w="/work" \
	seanmorris/pobot \
		node /app/index.js ${ARGS}

run-dev:
	docker run -it --rm \
	--ipc="host" \
	-e "DISPLAY=${DISPLAY}" \
	-v /tmp/.X11-unix:/tmp/.X11-unix \
	-v=${SCRIPTS}:/scripts/: \
	-v `pwd`:/work/ \
	-v `pwd`:/app/ \
	-w="/work" \
	seanmorris/pobot \
		node /app/index.js ${ARGS}

clean:
	@ rm -rf node_modules;
