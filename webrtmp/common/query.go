package common

import (
	"errors"
	"fmt"
	"net/url"
	"path"
	"time"

	"github.com/livepeer/webrtmp-server/ffmpeg"
)

type ParsedQuery struct {
	FfmpegOutput string
	MimeType     string
}

func ParseQuery(baseUrl *url.URL, query url.Values, strict bool) (ParsedQuery, error) {
	output, err := ffmpegOutput(baseUrl, query.Get("streamKey"), query.Get("rtmp"), strict)
	if err != nil {
		return ParsedQuery{}, err
	}
	mimeType := query.Get("mimeType")
	if strict && !ffmpeg.IsH264(mimeType) {
		return ParsedQuery{}, fmt.Errorf("unsupported mimeType: %s", mimeType)
	}
	return ParsedQuery{
		FfmpegOutput: output,
		MimeType:     mimeType,
	}, nil
}

func ffmpegOutput(baseUrl *url.URL, streamKey, rtmp string, strict bool) (string, error) {
	if streamKey != "" {
		return joinPath(baseUrl, streamKey).String(), nil
	} else if strict {
		return "", errors.New("missing streamKey query param")
	}
	if rtmp != "" {
		return rtmp, nil
	}
	return fmt.Sprintf("./out/output-%d.flv", time.Now().Unix()), nil
}

func joinPath(baseUrl *url.URL, segment string) *url.URL {
	url := *baseUrl
	url.Path = path.Join(url.Path, segment)
	return &url
}
