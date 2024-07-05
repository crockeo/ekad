package linereader

import (
	"errors"
	"io"
	"os"
	"os/signal"
	"syscall"
	"unicode/utf8"

	"golang.org/x/term"
)

const (
	Backspace rune = '\x7F'
	CtrlC     rune = '\x03'
	CtrlD     rune = '\x04'
)

type LineReader struct {
	input             []rune
	previousTermState *term.State
	signalChan        chan os.Signal
}

func New() (*LineReader, error) {
	previousTermState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		return nil, err
	}

	signalChan := make(chan os.Signal)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		_, open := <-signalChan
		if !open {
			return
		}
		term.Restore(int(os.Stdin.Fd()), previousTermState)
		// TODO: is there a way to make the program just deal with the signal as normal?
		os.Exit(1)
	}()

	return &LineReader{
		input:             make([]rune, 0),
		previousTermState: previousTermState,
		signalChan:        signalChan,
	}, nil
}

func (lr *LineReader) Close() error {
	errs := []error{}
	if err := term.Restore(int(os.Stdin.Fd()), lr.previousTermState); err != nil {
		errs = append(errs, err)
	}
	signal.Stop(lr.signalChan)
	return errors.Join(errs...)
}

// Read reads a single character from the user's input,
// and then returns the current input.
// Note that for certain actions (e.g. moving the cursor)
// the input returned by Read may be the same as the previous input.
// It is up to the caller to deduplicate responses if they care to.
func (lr *LineReader) Read() ([]rune, error) {
	var buf [1]byte
	_, err := os.Stdin.Read(buf[:])
	if err != nil {
		return nil, err
	}
	rune, _ := utf8.DecodeRune(buf[:])
	// TODO: handle left + right arrows
	// and then also handle what to do with that in terms of cursor position :)
	if rune == Backspace {
		if len(lr.input) > 0 {
			lr.input = lr.input[:len(lr.input)-1]
		}
	} else if rune == CtrlC {
		// TODO: better way to handle this than just returning an EOF :/
		// this is not the same thing as EOF (which should be returned through Ctrl+D)
		return nil, io.EOF
	} else if rune == CtrlD {
		return nil, io.EOF
	} else if rune < '\x20' {
		// Intentionally ignore all other control characters,
		// and only accept characters which are symbolic in some way.
	} else {
		lr.input = append(lr.input, rune)
	}
	return lr.input, nil
}
