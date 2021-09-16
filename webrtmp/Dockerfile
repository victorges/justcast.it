FROM golang:1.16 AS build

WORKDIR /usr/build

COPY go.mod go.sum ./
RUN go mod download

ARG version
RUN echo $version

COPY . .
RUN GOOS=linux GOARCH=amd64 make "version=$version"

FROM debian:stretch-slim

RUN apt update && \
  apt install -y ffmpeg && \
  apt clean && apt autoclean
RUN ffmpeg -version

WORKDIR /usr/app

RUN mkdir ./out
COPY --from=build /usr/build/jsfiddle ./jsfiddle
COPY --from=build /usr/build/webrtmp ./

ENTRYPOINT [ "./webrtmp" ]
