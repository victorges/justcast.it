version ?= $(shell git describe --tag --dirty)
ldflags := -X 'main.Version=$(version)'

dockerimg := livepeer/webrtmp-server

.PHONY: build run docker docker_build docker_run docker_push

build:
	CGO_ENABLED=0 go build -o webrtmp -ldflags="$(ldflags)" main.go

run:
	LP_HOST=0.0.0.0 go run -ldflags="$(ldflags)" main.go

docker: docker_build docker_run

docker_build:
	docker build --progress=plain -t $(dockerimg) -t $(dockerimg):$(version) --build-arg version=$(version) .

docker_run:
	docker run -it --rm --name=webrtmp -p 7867:7867 -e LP_HOST=0.0.0.0 $(dockerimg) $(args)

docker_push:
	docker push $(dockerimg):latest
	docker push $(dockerimg):$(version)
