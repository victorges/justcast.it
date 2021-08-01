package ffmpeg

import (
	"context"
	"io"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/golang/glog"
	"github.com/pion/webrtc/v3"
)

type Opts struct {
	Input           []string
	InVideoMimeType string
	Output          string
}

var baseArgs = []string{"-f", "flv", "-c:a", "aac", "-b:a", "128k", "-ar", "44100"}

var videoCopyArgs = append([]string{}, append(baseArgs, "-c:v", "copy")...)
var videoTranscodeArgs = append([]string{}, append(baseArgs,
	"-v:c", "libx264",
	"-x264-params", "keyint=60:scenecut=0")...)

func delayedCtx(ctx context.Context, delay time.Duration) context.Context {
	delayed, cancel := context.WithCancel(context.Background())
	go func() {
		<-ctx.Done()
		<-time.After(delay)
		cancel()
	}()
	return delayed
}

func Run(ctx context.Context, opts Opts) error {
	var args []string
	for _, in := range opts.Input {
		args = append(args, "-i", in)
	}
	if strings.EqualFold(opts.InVideoMimeType, webrtc.MimeTypeH264) {
		args = append(args, videoCopyArgs...)
	} else {
		args = append(args, videoTranscodeArgs...)
	}
	args = append(args, opts.Output)

	glog.Infof("Starting ffmpeg: ffmpeg %s", strings.Join(args, " "))
	cmd := exec.CommandContext(delayedCtx(ctx, 20*time.Second), "ffmpeg", args...)
	go func() {
		<-ctx.Done()
		if err := cmd.Process.Signal(os.Interrupt); err != nil {
			log.Println("Error interrupting ffmpeg:", err)
		}
	}()

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	go io.Copy(os.Stdout, stderr)
	go io.Copy(os.Stdout, stdout)
	return cmd.Run()
}
