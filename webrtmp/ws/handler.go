package ws

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/golang/glog"
	"github.com/gorilla/websocket"
	"github.com/livepeer/webrtmp-server/common"
	"github.com/livepeer/webrtmp-server/ffmpeg"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  10 * 1024, // enough for 9k jumbo frames
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func Handler(rtmpUrl string, strict bool) (http.Handler, error) {
	baseUrl, err := url.Parse(rtmpUrl)
	if err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		query, err := common.ParseQuery(baseUrl, req.URL.Query(), strict)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}

		ws, err := upgrader.Upgrade(rw, req, nil)
		if err != nil {
			glog.Errorf("Error upgrading request to WebSocket url=%q err=%q", req.URL, err)
			return
		}
		defer ws.Close()

		ctx, cancel := context.WithCancel(req.Context())
		defer cancel()
		stdin, pipe := io.Pipe()
		go func() {
			defer cancel()
			err := copyWsMessages(ws, pipe)
			if err != nil {
				glog.Errorf("Error copying WebSocket messages url=%q err=%q", req.URL, err)
			}
		}()

		glog.Infof("Starting WebSocket ffmpeg process for url=%q", req.URL)
		err = ffmpeg.Run(ctx, ffmpeg.Opts{
			Output:          query.FfmpegOutput,
			InVideoMimeType: query.MimeType,
			Stdin:           stdin,
		})
		glog.Infof("Finished WebSocket ffmpeg process for url=%q err=%q", req.URL, err)

		code := 1000
		if err != nil {
			code = 1011
		}
		message := websocket.FormatCloseMessage(code, "")
		err = ws.WriteControl(websocket.CloseMessage, message, time.Now().Add(5*time.Second))
		if err != nil {
			glog.Infof("Error closing WebSocket url=%q err=%q", req.URL, err)
		}
	}), nil
}

func copyWsMessages(ws *websocket.Conn, dest io.Writer) error {
	buf := make([]byte, upgrader.ReadBufferSize)
	for {
		_, reader, err := ws.NextReader()
		if _, isClosed := err.(*websocket.CloseError); isClosed {
			return nil
		} else if err != nil {
			return fmt.Errorf("error getting next ws message: %w", err)
		}

		_, err = io.CopyBuffer(dest, reader, buf)
		if err != nil {
			return fmt.Errorf("error copying websocket message: %w", err)
		}
	}
}
