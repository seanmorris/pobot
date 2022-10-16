FROM debian:bullseye-20221004-slim as base
MAINTAINER Sean Morris <sean@seanmorr.is>
RUN apt-get update
RUN apt-get install -y gnupg curl  apt-transport-https \
	&& curl -sL https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
	&& sh -c 'echo "deb https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'

RUN apt-get update \
	&& apt-get install google-chrome-stable -y \
	&& curl -sL https://deb.nodesource.com/setup_14.x | bash -

RUN apt update \
	&& apt install -y nodejs

RUN useradd chrome-user \
	&& mkdir /home/chrome-user \
	&& chown chrome-user /home/chrome-user

RUN mkdir /app

WORKDIR /app/

USER chrome-user

FROM base as standalone

USER root

ADD ./ /app/
RUN cd /app && npm install

USER chrome-user

CMD node bin/pobot.js
