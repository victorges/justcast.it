package ffmpeg

import (
	"context"
	"io"
	"os"
	"os/exec"
	"strings"

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

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	go io.Copy(os.Stderr, stderr)
	go io.Copy(os.Stderr, stdout)
	return cmd.Run()
}
