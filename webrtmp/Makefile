version ?= $(shell git describe --tag --dirty)
ldflags := -X 'main.Version=$(version)'

dockerimg := livepeer/webrtmp-server

.PHONY: build run docker publish docker_build docker_run docker_push

build:
	CGO_ENABLED=0 go build -o webrtmp -ldflags="$(ldflags)" main.go

run:
	LP_HOST=0.0.0.0 go run -ldflags="$(ldflags)" main.go

docker: docker_build docker_run
publish: docker_build docker_push

docker_build:
	docker build --progress=plain -t $(dockerimg) -t $(dockerimg):$(version) --build-arg version=$(version) .

docker_run:
	docker run -it --rm --name=webrtmp -p 7867:7867 -e LP_HOST=0.0.0.0 $(dockerimg) $(args)

docker_push:
	docker push $(dockerimg):latest
	docker push $(dockerimg):$(version)

# Deprecated

.PHONY: gcp gcp_build gcp_deploy_gcrun gcp_deploy_gccompute

gcp: gcp_build gcp_deploy_gcrun gcp_deploy_gccompute

gcp_build:
	gcloud builds submit --tag us.gcr.io/justcast-it/justcast-it/webrtmp

gcp_deploy_gcrun:
	gcloud run deploy --image=us.gcr.io/justcast-it/justcast-it/webrtmp:latest --platform=managed --region=southamerica-east1 webrtmp

gcp_deploy_gccompute:
	gcloud compute instance-groups managed rolling-action restart go-webrtmp-ig-ue1 --region=us-east1
