FROM node:10-alpine AS build

ADD . /build

WORKDIR /build

RUN apk --update add python make g++ && \
    yarn install && \
    yarn run test && \
    yarn run tsc && \
    yarn install --production=true

FROM node:10-alpine AS runtime

COPY --from=build /build /app

WORKDIR /app

ENV PORT 8080

ENV DBURL http://localhost:5894

ENV DEBUG mqtt-http-gateway:*

CMD node dist
