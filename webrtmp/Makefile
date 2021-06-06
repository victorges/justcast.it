build:
	CGO_ENABLED=0 go build -o webrtmp

run:
	go run main.go

docker: docker-build docker-run

docker-build:
	docker build --progress=plain -t webrtmp .

docker-run:
	docker run -it --rm -p 7867:7867 --name webrtmp webrtmp

gcp: gcp-build gcp-deploy

gcp-build:
	gcloud builds submit --tag us.gcr.io/justcast-it/justcast-it/webrtmp

gcp-deploy:
	gcloud run deploy --image=us.gcr.io/justcast-it/justcast-it/webrtmp:latest --platform=managed --region=southamerica-east1 webrtmp
