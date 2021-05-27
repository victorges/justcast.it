FROM node:14-slim

RUN apt update && \
  apt install -y ffmpeg && \
  apt clean && apt autoclean
RUN ffmpeg -version

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

# RUN yarn --production --frozen-lockfile
RUN yarn --frozen-lockfile

COPY . ./

RUN yarn build:client

CMD [ "node", "src/server/index.js" ]
