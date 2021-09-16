// +build !js

package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"path"
	"strconv"

	"github.com/golang/glog"
	"github.com/livepeer/webrtmp-server/wrtc"
	"github.com/livepeer/webrtmp-server/ws"
	"github.com/peterbourgon/ff"
)

var (
	// Version content of this constant will be set at build time,
	// using -ldflags, using output of the `git describe` command.
	Version = "undefined"

	// CLI flags, bound in init below
	host           string
	port           uint
	apiRoot        string
	enableFiddle   bool
	rtmpUrl        string
	strictProtocol bool
)

func init() {
	fs := flag.NewFlagSet("webrtmp", flag.ExitOnError)

	// Server options
	fs.StringVar(&host, "host", "localhost", "Hostname to bind to")
	fs.UintVar(&port, "port", 7867, "Port to listen on")
	fs.StringVar(&apiRoot, "api-root", "/webrtmp", "Root path where to bind the API to")
	fs.BoolVar(&enableFiddle, "enable-fiddle", false, "Wether to serve some static files on root path to test service")
	fs.StringVar(&rtmpUrl, "rtmp-url", "rtmp://rtmp.livepeer.com/live/", "RTMP endpoint where to push streams to")
	fs.BoolVar(&strictProtocol, "strict-protocol", true, "With strict protocol, accept only safer requests. That includes only video-copy (no transcoding) and no custom RTMP URLs.")

	flag.Set("logtostderr", "true")
	glogVFlag := flag.Lookup("v")
	verbosity := fs.Int("v", 0, "Log verbosity {0-10}")

	fs.String("config", "", "config file (optional)")
	ff.Parse(fs, os.Args[1:],
		ff.WithConfigFileFlag("config"),
		ff.WithConfigFileParser(ff.PlainParser),
		ff.WithEnvVarPrefix("LP"),
	)
	flag.CommandLine.Parse(nil)
	glogVFlag.Value.Set(strconv.Itoa(*verbosity))
}

func main() {
	glog.Infof("WebRTMP server version=%q", Version)

	addr := fmt.Sprintf("%s:%d", host, port)
	handler := httpHandler()

	glog.Infof("Listening on: %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		glog.Fatalf("Error starting server: %v", err)
	}
}

func httpHandler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/_healthz", func(rw http.ResponseWriter, req *http.Request) {
		rw.WriteHeader(http.StatusOK)
	})
	wrtc, err := wrtc.Handler(rtmpUrl, strictProtocol)
	if err != nil {
		glog.Fatalf("Error initializing WebRTC handler: %v", err)
	}
	mux.Handle(path.Join(apiRoot, "/wrtc/offer"), wrtc)

	ws, err := ws.Handler(rtmpUrl, strictProtocol)
	if err != nil {
		glog.Fatalf("Error initializing WebSocket handler: %v", err)
	}
	mux.Handle(path.Join(apiRoot, "/ws"), ws)

	if enableFiddle {
		mux.Handle("/", http.FileServer(http.Dir("./jsfiddle")))
	}
	return cors(mux)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Set("Access-Control-Allow-Origin", "*")
		rw.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		next.ServeHTTP(rw, r)
	})
}
