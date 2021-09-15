// +build !js

package main

import (
	"log"
	"net/http"
	"os"

	"github.com/victorges/justcast.it/webrtmp/wrtc"
)

func main() {

	http.HandleFunc("/healthcheck", func(rw http.ResponseWriter, req *http.Request) {
		rw.WriteHeader(http.StatusOK)
	})

	wrtc, err := wrtc.Handler()
	if err != nil {
		log.Fatalf("Error initializing WebRTC handler: %v", err)
	}
	http.Handle("/webrtc/offer", wrtc)

	http.Handle("/", http.FileServer(http.Dir("./jsfiddle")))

	port := "7867"
	if env, ok := os.LookupEnv("PORT"); ok {
		port = env
	}
	log.Println("Listening on port :" + port)
	http.ListenAndServe(":"+port, nil)
}
