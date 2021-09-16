package util

import (
	"net/url"
	"path"
)

func JoinPath(baseUrl *url.URL, segment string) *url.URL {
	url := *baseUrl
	url.Path = path.Join(url.Path, segment)
	return &url
}
