package iox

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync/atomic"
	"syscall"

	"github.com/golang/glog"
)

var socketIdCounter int64 = 0

func newSocketPath() string {
	id := atomic.AddInt64(&socketIdCounter, 1)
	return fmt.Sprintf("/tmp/webrtmp-%d.sock", id)
}

func NewSocketWriter(ctx context.Context) (w io.WriteCloser, path string, err error) {
	path = newSocketPath()
	err = os.RemoveAll(path)
	if err != nil {
		return nil, "", fmt.Errorf("error removing previous pipe: %w", err)
	}
	err = syscall.Mkfifo(path, 0666)
	if err != nil {
		return nil, "", fmt.Errorf("error creating pipe: %w", err)
	}
	w, err = os.OpenFile(path, os.O_RDWR, os.ModeNamedPipe)
	if err != nil {
		return nil, "", fmt.Errorf("error opening write end: %w", err)
	}
	go func() {
		<-ctx.Done()
		writeErr := w.Close()
		if writeErr != nil {
			glog.Errorf("Error closing pipe. readErr=%q, writeErr=%q", writeErr, writeErr)
		}
	}()
	return w, path, nil
}
