.PHONY: test clean

build:
	@ docker -t seanmorris/pobot:latest

configure:
	@  npm install

clean:
	@ rm -rf node_modules package-lock.json;
