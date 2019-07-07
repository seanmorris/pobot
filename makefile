.PHONY: test clean

build:
	@ echo "No build steps."

configure:
	@  npm install

test:
	@ docker run --rm \
	-e "DISPLAY=${DISPLAY}" \
	-v /tmp/.X11-unix:/tmp/.X11-unix \
	seanmorris/pobot \
		node /app/index.js /app/example/openGoogle.js

clean:
	@ rm -rf node_modules package-lock.json;
