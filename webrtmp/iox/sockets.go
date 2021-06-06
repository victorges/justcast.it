package iox

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"sync/atomic"
	"time"
)

var socketIdCounter int64 = 0

func newSocketPath() string {
	id := atomic.AddInt64(&socketIdCounter, 1)
	return fmt.Sprintf("/tmp/webrtmp-%d.sock", id)
}

func NewSocketWriter(ctx context.Context) (w io.WriteCloser, path string, err error) {
	path = newSocketPath()

	if err := os.RemoveAll(path); err != nil {
		return nil, "", fmt.Errorf("error deleting existing socket: %w", err)
	}

	l, err := net.Listen("unix", path)
	if err != nil {
		return nil, "", fmt.Errorf("error opening server on socket: %w", err)
	}

	pipeRead, pipeWrite := io.Pipe()
	go func() {
		defer l.Close()
		var err error
		defer func() { pipeRead.CloseWithError(err) }()

		// We only support 1 reader
		conn, err := l.Accept()
		if err != nil {
			log.Fatal("accept error:", err)
		}
		defer conn.Close()

		buf := make([]byte, 32*1024)
		n, bytes := 0, 0
		for ctx.Err() == nil {
			n, err = pipeRead.Read(buf)
			if err == io.EOF || ctx.Err() != nil {
				err = nil
				break
			} else if err != nil {
				log.Printf("Error reading pipe: %v\n", err)
				break
			}

			conn.SetDeadline(time.Now().Add(5 * time.Second))
			n, err = conn.Write(buf[:n])
			if err != nil {
				log.Printf("Error writing to unix socket: %v\n", err)
				break
			}
			bytes += n
		}
		mib := float64(bytes) / 1024 / 1024
		log.Printf("Piped %.1fMiB bytes through socket\n", mib)
	}()
	return pipeWrite, path, nil
}
