// +build !js

package main

import (
	"flag"
	"net/http"
	"os"

	"github.com/golang/glog"
	"github.com/victorges/justcast.it/webrtmp/wrtc"
	"github.com/victorges/justcast.it/webrtmp/ws"
)

func main() {
	flag.Set("logtostderr", "true")
	flag.Parse()

	http.HandleFunc("/healthcheck", func(rw http.ResponseWriter, req *http.Request) {
		rw.WriteHeader(http.StatusOK)
	})

	wrtc, err := wrtc.Handler()
	if err != nil {
		glog.Fatalf("Error initializing WebRTC handler: %v", err)
	}
	http.Handle("/webrtc/offer", wrtc)

	ws, err := ws.Handler("rtmp://rtmp.livepeer.com/live")
	if err != nil {
		glog.Fatalf("Error initializing WebSocket handler: %v", err)
	}
	http.Handle("/ws", ws)

	http.Handle("/", http.FileServer(http.Dir("./jsfiddle")))

	port := "7867"
	if env, ok := os.LookupEnv("PORT"); ok {
		port = env
	}
	glog.Infof("Listening on port :" + port)
	http.ListenAndServe(":"+port, nil)
}
