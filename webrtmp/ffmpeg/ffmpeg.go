package ffmpeg

import (
	"context"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/golang/glog"
)

type Opts struct {
	Input           []string
	Stdin           io.Reader
	InVideoMimeType string
	Output          string
}

var baseArgs = []string{"-f", "flv", "-c:a", "aac", "-b:a", "128k", "-ar", "44100"}

var videoCopyArgs = append([]string{}, append(baseArgs, "-c:v", "copy")...)
var videoTranscodeArgs = append([]string{}, append(baseArgs,
	"-c:v", "libx264",
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
	if opts.Stdin != nil && len(opts.Input) == 0 {
		args = append(args, "-i", "-")
	}
	if IsH264(opts.InVideoMimeType) {
		args = append(args, videoCopyArgs...)
	} else {
		args = append(args, videoTranscodeArgs...)
	}
	args = append(args, opts.Output)

	cmd := exec.CommandContext(delayedCtx(ctx, 20*time.Second), "ffmpeg", args...)
	go func() {
		<-ctx.Done()
		if err := cmd.Process.Signal(os.Interrupt); err != nil {
			glog.Infoln("Error interrupting ffmpeg:", err)
		}
	}()

	cmd.Stdin = opts.Stdin
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

func IsH264(mimeType string) bool {
	return strings.Contains(strings.ToUpper(mimeType), "H264")
}
