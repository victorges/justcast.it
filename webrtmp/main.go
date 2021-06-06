// +build !js

package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
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

func getH264File() (media.Writer, string) {
	h264Writer, h264Path, err := iox.NewSocketWriter()
	if err != nil {
		panic(err)
	}
	h264File := h264writer.NewWith(h264Writer)
	return h264File, h264Path
}

func saveToDisk(i media.Writer, track *webrtc.TrackRemote) {
	defer func() {
		if err := i.Close(); err != nil {
			panic(err)
		}
	}()

	for {
		rtpPacket, _, err := track.ReadRTP()
		if err != nil {
			panic(err)
		}
		if err := i.WriteRTP(rtpPacket); err != nil {
			panic(err)
		}
	}
}

func main() {
	// Everything below is the Pion WebRTC API! Thanks for using it ❤️.

	// Create a MediaEngine object to configure the supported codec
	m := &webrtc.MediaEngine{}

	// Setup the codecs you want to use.
	// We'll use a VP8 and Opus but you can also define your own
	if err := m.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000, Channels: 0, SDPFmtpLine: "", RTCPFeedback: nil},
		PayloadType:        96,
	}, webrtc.RTPCodecTypeVideo); err != nil {
		panic(err)
	}
	if err := m.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 0, SDPFmtpLine: "", RTCPFeedback: nil},
		PayloadType:        111,
	}, webrtc.RTPCodecTypeAudio); err != nil {
		panic(err)
	}

	// Create a InterceptorRegistry. This is the user configurable RTP/RTCP Pipeline.
	// This provides NACKs, RTCP Reports and other features. If you use `webrtc.NewPeerConnection`
	// this is enabled by default. If you are manually managing You MUST create a InterceptorRegistry
	// for each PeerConnection.
	i := &interceptor.Registry{}

	// Use the default set of Interceptors
	if err := webrtc.RegisterDefaultInterceptors(m, i); err != nil {
		panic(err)
	}

	// Create the API object with the MediaEngine
	api := webrtc.NewAPI(webrtc.WithMediaEngine(m), webrtc.WithInterceptorRegistry(i))

	// Prepare the configuration
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	// Create a new RTCPeerConnection
	peerConnection, err := api.NewPeerConnection(config)
	if err != nil {
		panic(err)
	}

	// Allow us to receive 1 audio track, and 1 video track
	if _, err = peerConnection.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio); err != nil {
		panic(err)
	} else if _, err = peerConnection.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo); err != nil {
		panic(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Set a handler for when a new remote track starts, this handler saves buffers to disk as
	// an ivf file, since we could have multiple video tracks we provide a counter.
	// In your application this is where you would handle/process video
	ffmpegOpts := ffmpeg.FFmpegOpts{
		Output: fmt.Sprintf("output-%d.flv", time.Now().Unix()),
	}
	closers := []io.Closer{}
	peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		// Send a PLI on an interval so that the publisher is pushing a keyframe every rtcpPLIInterval
		go func() {
			ticker := time.NewTicker(2 * time.Second)
			for range ticker.C {
				errSend := peerConnection.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: uint32(track.SSRC())}})
				if errSend != nil {
					fmt.Println(errSend)
				}
			}
		}()

		var socketPath string
		var lazyDest func() media.Writer

		codec := track.Codec()
		if strings.EqualFold(codec.MimeType, webrtc.MimeTypeOpus) {
			fmt.Println("Got Opus track, saving to disk as output.ogg (48 kHz, 2 channels)")
			oggDest, oggPath, err := iox.NewSocketWriter()
			if err != nil {
				panic(err)
			}
			socketPath, lazyDest = oggPath, func() media.Writer { return getOggFile(oggDest) }
		} else if strings.EqualFold(codec.MimeType, webrtc.MimeTypeH264) {
			fmt.Println("Got H.264 track, saving to disk as output.h264")
			h264File, h264path := getH264File()
			socketPath, lazyDest = h264path, func() media.Writer { return h264File }

			ffmpegOpts.InVideoMimeType = codec.MimeType
		}
		ffmpegOpts.Input = append(ffmpegOpts.Input, "unix:"+socketPath)
		if len(ffmpegOpts.Input) == 2 {
			go func() {
				if err := ffmpeg.Run(ctx, ffmpegOpts); err != nil {
					panic(err)
				}
			}()
		}

		dest := lazyDest()
		closers = append(closers, dest)
		saveToDisk(dest, track)
	})

	// Set the handler for ICE connection state
	// This will notify you when the peer has connected/disconnected
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Printf("Connection State has changed %s \n", connectionState.String())

		if connectionState == webrtc.ICEConnectionStateConnected {
			fmt.Println("Ctrl+C the remote client to stop the demo")
		} else if connectionState == webrtc.ICEConnectionStateFailed ||
			connectionState == webrtc.ICEConnectionStateDisconnected {

			for _, closer := range closers {
				if err := closer.Close(); err != nil {
					panic(err)
				}
			}
			cancel()

			fmt.Println("Done writing media files")
			os.Exit(0)
		}
	})

	// Wait for the offer to be pasted
	offer := webrtc.SessionDescription{}
	iox.Decode(iox.MustReadStdin(), &offer)

	// Set the remote SessionDescription
	err = peerConnection.SetRemoteDescription(offer)
	if err != nil {
		panic(err)
	}

	// Create answer
	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		panic(err)
	}

	// Create channel that is blocked until ICE Gathering is complete
	gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

	// Sets the LocalDescription, and starts our UDP listeners
	err = peerConnection.SetLocalDescription(answer)
	if err != nil {
		panic(err)
	}

	// Block until ICE Gathering is complete, disabling trickle ICE
	// we do this because we only can exchange one signaling message
	// in a production application you should exchange ICE Candidates via OnICECandidate
	<-gatherComplete

	// Output the answer in base64 so we can paste it in browser
	fmt.Println(iox.Encode(*peerConnection.LocalDescription()))

	// Block forever
	select {}
}
