name := livepeer/webrtmp-server
version ?= v0.1.0
dockerimg := $(name):$(version)
gcrimg := us.gcr.io/justcast-it/$(name):latest

.PHONY: run fly gcp gcp_run gcp_compute

run:
	docker run -it --rm --name=webrtmp -p 7867:7867 \
			-e LP_HOST=0.0.0.0 \
			-e LP_ENABLE_FIDDLE=true \
			-e LP_STRICT_PROTOCOL=false \
			$(dockerimg) $(args)

fly:
	flyctl deploy --image $(dockerimg)

gcp: gcp_push gcp_run gcp_compute

gcp_push:
	docker pull $(dockerimg)
	docker tag $(dockerimg) $(gcrimg)
	docker push $(gcrimg)

gcp_run:
	gcloud run deploy --image=$(gcrimg) --platform=managed --region=southamerica-east1 webrtmp

gcp_compute:
	gcloud compute instance-groups managed rolling-action restart go-webrtmp-ig-ue1 --region=us-east1
