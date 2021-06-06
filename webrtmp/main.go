// +build !js

package main

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pion/interceptor"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
	"github.com/pion/webrtc/v3/pkg/media/h264writer"
	"github.com/pion/webrtc/v3/pkg/media/oggwriter"

	"github.com/victorges/justcast.it/webrtmp/ffmpeg"
	"github.com/victorges/justcast.it/webrtmp/iox"
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

func configurePeerConnection(conn *webrtc.PeerConnection) {
	// Allow us to receive 1 audio track, and 1 video track
	if _, err := conn.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio); err != nil {
		panic(err)
	} else if _, err = conn.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo); err != nil {
		panic(err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Set a handler for when a new remote track starts, this handler saves buffers to disk as
	// an ivf file, since we could have multiple video tracks we provide a counter.
	// In your application this is where you would handle/process video
	ffmpegOpts := ffmpeg.Opts{
		Output: fmt.Sprintf("./out/output-%d.flv", time.Now().Unix()),
	}
	tracskWg := sync.WaitGroup{}
	conn.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
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
					log.Println(errSend)
				}
			}
		}()
		tracskWg.Add(1)
		defer tracskWg.Done()

		var socketPath string
		var lazyDest func() media.Writer

		codec := track.Codec()
		if strings.EqualFold(codec.MimeType, webrtc.MimeTypeOpus) {
			log.Println("Got Opus track, saving to disk as output.ogg (48 kHz, 2 channels)")
			oggDest, oggPath, err := iox.NewSocketWriter(ctx)
			if err != nil {
				panic(err)
			}
			socketPath, lazyDest = oggPath, func() media.Writer { return getOggFile(oggDest) }
		} else if strings.EqualFold(codec.MimeType, webrtc.MimeTypeH264) {
			log.Println("Got H.264 track, saving to disk as output.h264")
			h264File, h264path := getH264File(ctx)
			socketPath, lazyDest = h264path, func() media.Writer { return h264File }

			ffmpegOpts.InVideoMimeType = codec.MimeType
		}
		ffmpegOpts.Input = append(ffmpegOpts.Input, "unix:"+socketPath)
		if len(ffmpegOpts.Input) == 2 {
			go func() {
				log.Println("Starting ffmpeg writing to", ffmpegOpts.Output)
				ffmpegCtx, cancel := context.WithCancel(context.Background())
				go func() {
					tracskWg.Wait()
					log.Println("Stopping ffmpeg")
					cancel()
				}()
				if err := ffmpeg.Run(ffmpegCtx, ffmpegOpts); err != nil {
					log.Println("Error returned by ffmpeg cmd", err)
				}
			}()
		}

		err := saveToDisk(ctx, lazyDest(), track)
		if err != nil {
			log.Printf("Error saving %s to disk: %v\n", codec.MimeType, err)
		}
	})

	// Set the handler for ICE connection state
	// This will notify you when the peer has connected/disconnected
	conn.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		log.Println("Connection State has changed", connectionState)

		if connectionState == webrtc.ICEConnectionStateConnected {
			log.Println("Ctrl+C the remote client to stop the demo")
		} else if connectionState == webrtc.ICEConnectionStateFailed ||
			connectionState == webrtc.ICEConnectionStateDisconnected {
			conn.Close()
			cancel()
		}
	})
}

func main() {
	// Everything below is the Pion WebRTC API! Thanks for using it ❤️.

	// Create a MediaEngine object to configure the supported codec
	engine := &webrtc.MediaEngine{}

	// Setup the codecs you want to use.
	// We'll use a VP8 and Opus but you can also define your own
	if err := engine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000, Channels: 0, SDPFmtpLine: "", RTCPFeedback: nil},
		PayloadType:        96,
	}, webrtc.RTPCodecTypeVideo); err != nil {
		panic(err)
	}
	if err := engine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 0, SDPFmtpLine: "", RTCPFeedback: nil},
		PayloadType:        111,
	}, webrtc.RTPCodecTypeAudio); err != nil {
		panic(err)
	}

	// Create a InterceptorRegistry. This is the user configurable RTP/RTCP Pipeline.
	// This provides NACKs, RTCP Reports and other features. If you use `webrtc.NewPeerConnection`
	// this is enabled by default. If you are manually managing You MUST create a InterceptorRegistry
	// for each PeerConnection.
	interceptors := &interceptor.Registry{}

	// Use the default set of Interceptors
	if err := webrtc.RegisterDefaultInterceptors(engine, interceptors); err != nil {
		panic(err)
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

	http.HandleFunc("/webrtc/offer", func(rw http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			rw.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Create a new RTCPeerConnection
		peerConnection, err := api.NewPeerConnection(config)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(rw, err)
			return
		}
		configurePeerConnection(peerConnection)

		// Wait for the offer to be pasted
		offer := webrtc.SessionDescription{}
		bytes, err := ioutil.ReadAll(req.Body)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(rw, err)
			return
		}
		iox.Decode(string(bytes), &offer)

		// Set the remote SessionDescription
		err = peerConnection.SetRemoteDescription(offer)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(rw, err)
			return
		}

		// Create answer
		answer, err := peerConnection.CreateAnswer(nil)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(rw, err)
			return
		}

		// Create channel that is blocked until ICE Gathering is complete
		gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

		// Sets the LocalDescription, and starts our UDP listeners
		err = peerConnection.SetLocalDescription(answer)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(rw, err)
			return
		}

		// Block until ICE Gathering is complete, disabling trickle ICE
		// we do this because we only can exchange one signaling message
		// in a production application you should exchange ICE Candidates via OnICECandidate
		<-gatherComplete

		rw.WriteHeader(http.StatusOK)
		// Output the answer in base64 so we can paste it in browser
		fmt.Fprintln(rw, iox.Encode(*peerConnection.LocalDescription()))
	})

	http.Handle("/", http.FileServer(http.Dir("./jsfiddle")))

	log.Println("Listening on port :7867")
	http.ListenAndServe(":7867", nil)
}
