package wrtc

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang/glog"
	"github.com/livepeer/webrtmp-server/common"
	"github.com/livepeer/webrtmp-server/ffmpeg"
	"github.com/livepeer/webrtmp-server/iox"
	"github.com/pion/interceptor"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
	"github.com/pion/webrtc/v3/pkg/media/h264writer"
	"github.com/pion/webrtc/v3/pkg/media/oggwriter"
)

func getOggFile(dest io.WriteCloser) media.Writer {
	oggFile, err := oggwriter.NewWith(dest, 48000, 2)
	if err != nil {
		panic(err)
	}
	return oggFile
}

func getH264File(ctx context.Context) (media.Writer, string) {
	h264Writer, h264Path, err := iox.NewSocketWriter(ctx)
	if err != nil {
		panic(err)
	}
	h264File := h264writer.NewWith(h264Writer)
	return h264File, h264Path
}

func saveToDisk(ctx context.Context, i media.Writer, track *webrtc.TrackRemote) (retErr error) {
	defer func() {
		if err := i.Close(); err != nil {
			retErr = err
		}
	}()

	for ctx.Err() == nil {
		track.SetReadDeadline(time.Now().Add(5 * time.Second))
		rtpPacket, _, err := track.ReadRTP()
		if err == io.EOF || ctx.Err() != nil {
			break
		} else if err != nil {
			return err
		}
		if err := i.WriteRTP(rtpPacket); err != nil {
			return err
		}
	}
	return nil
}

func waitGroupContext(wg *sync.WaitGroup) context.Context {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		wg.Wait()
		cancel()
	}()
	return ctx
}

func mergeOpts(baseOpts ffmpeg.Opts, toMerge <-chan ffmpeg.Opts, numInputs int) ffmpeg.Opts {
	opts := baseOpts
	for len(opts.Input) < numInputs {
		merge := <-toMerge
		opts.Input = append(opts.Input, merge.Input...)
		if merge.Output != "" {
			opts.Output = merge.Output
		}
		if merge.InVideoMimeType != "" {
			opts.InVideoMimeType = merge.InVideoMimeType
		}
	}
	return opts
}

func prepareFfmpeg(wg *sync.WaitGroup, baseOpts ffmpeg.Opts, numInputs int) (inputs chan<- ffmpeg.Opts) {
	inputChan := make(chan ffmpeg.Opts)
	go func() {
		opts := mergeOpts(baseOpts, inputChan, numInputs)
		close(inputChan)

		glog.Infoln("Starting ffmpeg writing to", opts.Output)
		if err := ffmpeg.Run(waitGroupContext(wg), opts); err != nil {
			glog.Infoln("Error returned by ffmpeg cmd", err)
		}
	}()
	return inputChan
}

func configurePeerConnection(conn *webrtc.PeerConnection, output string) error {
	// Allow us to receive 1 audio track, and 1 video track
	if _, err := conn.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio); err != nil {
		return err
	} else if _, err = conn.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo); err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Set a handler for when a new remote track starts, this handler saves buffers to disk as
	// an ivf file, since we could have multiple video tracks we provide a counter.
	// In your application this is where you would handle/process video
	tracskWg := sync.WaitGroup{}
	ffmpegOpts := prepareFfmpeg(&tracskWg, ffmpeg.Opts{Output: output}, 2)
	conn.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		defer func() {
			if rec := recover(); rec != nil {
				glog.Infof("Panic processing WebRTC track: %v", rec)
				conn.Close()
				return
			}
		}()
		// Send a PLI on an interval so that the publisher is pushing a keyframe every rtcpPLIInterval
		go func() {
			ticker := time.NewTicker(2 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
				case <-ctx.Done():
					return
				}
				errSend := conn.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: uint32(track.SSRC())}})
				if errSend != nil {
					glog.Infoln(errSend)
				}
			}
		}()
		tracskWg.Add(1)
		defer tracskWg.Done()

		var socketPath string
		var lazyDest func() media.Writer

		codec := track.Codec()
		if strings.EqualFold(codec.MimeType, webrtc.MimeTypeOpus) {
			glog.Infoln("Got Opus track, saving to disk as output.ogg (48 kHz, 2 channels)")
			oggDest, oggPath, err := iox.NewSocketWriter(ctx)
			if err != nil {
				panic(err)
			}
			socketPath, lazyDest = oggPath, func() media.Writer { return getOggFile(oggDest) }
		} else if strings.EqualFold(codec.MimeType, webrtc.MimeTypeH264) {
			glog.Infoln("Got H.264 track, saving to disk as output.h264")
			h264File, h264path := getH264File(ctx)
			socketPath, lazyDest = h264path, func() media.Writer { return h264File }

			ffmpegOpts <- ffmpeg.Opts{InVideoMimeType: codec.MimeType}
		}
		ffmpegOpts <- ffmpeg.Opts{Input: []string{"unix:" + socketPath}}

		err := saveToDisk(ctx, lazyDest(), track)
		if err != nil {
			glog.Infof("Error saving %s to disk: %v\n", codec.MimeType, err)
		}
	})

	// Set the handler for ICE connection state
	// This will notify you when the peer has connected/disconnected
	conn.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		glog.Infoln("Connection State has changed", connectionState)

		if connectionState == webrtc.ICEConnectionStateConnected {
			glog.Infoln("Ctrl+C the remote client to stop the demo")
		} else if connectionState == webrtc.ICEConnectionStateFailed ||
			connectionState == webrtc.ICEConnectionStateDisconnected {
			conn.Close()
			cancel()
		}
	})
	return nil
}

func Handler(rtmpUrl string, strict bool) (http.Handler, error) {
	baseUrl, err := url.Parse(rtmpUrl)
	if err != nil {
		return nil, err
	}

	// A lot below is the Pion WebRTC API! Thanks for using it ❤️.
	// Create a MediaEngine object to configure the supported codec
	engine := &webrtc.MediaEngine{}

	// Setup the codecs you want to use.
	// We'll use a VP8 and Opus but you can also define your own
	if err := engine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000, Channels: 0, SDPFmtpLine: "", RTCPFeedback: nil},
		PayloadType:        96,
	}, webrtc.RTPCodecTypeVideo); err != nil {
		return nil, err
	}
	if err := engine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 0, SDPFmtpLine: "", RTCPFeedback: nil},
		PayloadType:        111,
	}, webrtc.RTPCodecTypeAudio); err != nil {
		return nil, err
	}

	// Create a InterceptorRegistry. This is the user configurable RTP/RTCP Pipeline.
	// This provides NACKs, RTCP Reports and other features. If you use `webrtc.NewPeerConnection`
	// this is enabled by default. If you are manually managing You MUST create a InterceptorRegistry
	// for each PeerConnection.
	interceptors := &interceptor.Registry{}

	// Use the default set of Interceptors
	if err := webrtc.RegisterDefaultInterceptors(engine, interceptors); err != nil {
		return nil, err
	}

	// Create the API object with the MediaEngine
	api := webrtc.NewAPI(
		webrtc.WithMediaEngine(engine),
		webrtc.WithInterceptorRegistry(interceptors),
	)
	// Prepare the configuration
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			if req.Method == http.MethodOptions {
				rw.WriteHeader(http.StatusOK)
			} else {
				rw.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}
		mimeType, _, _ := mime.ParseMediaType(req.Header.Get("Content-Type"))
		if mimeType != "application/json" {
			rw.WriteHeader(http.StatusBadRequest)
			fmt.Fprintln(rw, "Unsupported mime type", mimeType)
			return
		}
		handleErr := func(err error, status int) bool {
			if err == nil {
				return false
			}
			if status == 0 {
				status = http.StatusInternalServerError
			}
			rw.WriteHeader(status)
			fmt.Fprintln(rw, err)
			return true
		}

		// Wait for the offer to be pasted
		var offer webrtc.SessionDescription
		decoder := json.NewDecoder(req.Body)
		if err := decoder.Decode(&offer); handleErr(err, http.StatusBadRequest) {
			return
		}

		output, err := common.ParseFfmpegOutput(baseUrl, req.URL.Query(), strict)
		if err != nil {
			handleErr(err, http.StatusBadRequest)
			return
		}

		// Create a new RTCPeerConnection
		peerConnection, err := api.NewPeerConnection(config)
		if handleErr(err, 0) {
			return
		}
		err = configurePeerConnection(peerConnection, output)
		if handleErr(err, 0) {
			return
		}
		// Set the remote SessionDescription
		err = peerConnection.SetRemoteDescription(offer)
		if handleErr(err, 0) {
			return
		}

		// Create answer
		answer, err := peerConnection.CreateAnswer(nil)
		if handleErr(err, 0) {
			return
		}

		// Create channel that is blocked until ICE Gathering is complete
		gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

		// Sets the LocalDescription, and starts our UDP listeners
		err = peerConnection.SetLocalDescription(answer)
		if handleErr(err, 0) {
			return
		}

		// Block until ICE Gathering is complete, disabling trickle ICE
		// we do this because we only can exchange one signaling message
		// in a production application you should exchange ICE Candidates via OnICECandidate
		<-gatherComplete

		rw.Header().Add("Content-Type", "application/json")
		rw.WriteHeader(http.StatusOK)
		bytes, err := json.Marshal(*peerConnection.LocalDescription())
		if handleErr(err, 0) {
			return
		}
		rw.Write(bytes)
	}), nil
}
