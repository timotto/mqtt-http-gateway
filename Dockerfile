FROM node:8-alpine

ADD . /app

WORKDIR /app

RUN apk update && apk add python make g++

RUN npm install -g yarn

RUN yarn install

RUN yarn run tsc

ENV PORT 8080

ENV DBURL http://localhost:5894

ENV DEBUG mqtt-http-gateway:*

CMD node dist
