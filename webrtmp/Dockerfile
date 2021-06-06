FROM golang:1.16 AS build

WORKDIR /usr/build

COPY go.mod go.sum ./
RUN go mod download

COPY . ./
RUN GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o webrtmp

FROM alpine

RUN apk add --no-cache ffmpeg
RUN ffmpeg -version

WORKDIR /usr/app

COPY --from=build /usr/build/jsfiddle ./jsfiddle
COPY --from=build /usr/build/webrtmp ./

CMD [ "./webrtmp" ]
