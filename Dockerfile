FROM node:14-slim AS build

WORKDIR /usr/build

COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile

COPY . ./
RUN yarn build

FROM node:14-slim

RUN apt update && \
  apt install -y ffmpeg && \
  apt clean && apt autoclean
RUN ffmpeg -version

WORKDIR /usr/app

COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile --production

COPY --from=build /usr/build/lib ./lib
COPY --from=build /usr/build/public ./public

CMD [ "node", "lib/index.js" ]
