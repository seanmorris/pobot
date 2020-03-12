.PHONY: build build-dev configure run run-dev clean

SHELL=/bin/bash

PROJECT =pobot
REPO    =seanmorris

HASH :=$(shell echo _$$(git rev-parse --short HEAD 2>/dev/null) || echo init)
TAG  :=$(shell git describe --tags 2>/dev/null || echo ${HASH})

FULLNAME ?=${REPO}/${PROJECT}:${TAG}

build:
	@ docker build . \
		-t seanmorris/pobot:latest  \
		-t seanmorris/pobot:${HASH} \
		-t seanmorris/pobot:${TAG}
push:
	@ docker push seanmorris/pobot:latest
	@ docker push seanmorris/pobot:${HASH}
	@ docker push seanmorris/pobot:${TAG}

build-dev:
	@ docker build --target base \
		-t seanmorris/pobot-dev:latest .

configure:
	@ docker run -it --rm \
		-v `pwd`:/work/ \
		-w="/work" \
		seanmorris/pobot \
			npm install

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
