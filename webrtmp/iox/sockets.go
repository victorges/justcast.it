package iox

import (
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"sync/atomic"
)

var socketIdCounter int64 = 0

func newSocketPath() string {
	id := atomic.AddInt64(&socketIdCounter, 1)
	return fmt.Sprintf("/tmp/webrtmp-%d.sock", id)
}

func NewSocketWriter() (w io.WriteCloser, path string, err error) {
	path = newSocketPath()

	if err := os.RemoveAll(path); err != nil {
		return nil, "", fmt.Errorf("Error deleting existing socket: %w", err)
	}

	l, err := net.Listen("unix", path)
	if err != nil {
		return nil, "", fmt.Errorf("error opening server on socket: %w", err)
	}

	pipeIn, pipeOut := io.Pipe()
	go func() {
		defer l.Close()
		for {
			conn, err := l.Accept()
			if err != nil {
				log.Fatal("accept error:", err)
			}

			// We only support 1 reader at a time
			n, err := io.Copy(conn, pipeIn)
			log.Println("Piped", n, "bytes through socket with err", err)
			if err == nil {
				return
			}
		}
	}()
	return pipeOut, path, nil
}