package linereader

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"unicode/utf8"

	"golang.org/x/term"
)

const (
	Backspace rune = '\x7F'
	CtrlC     rune = '\x03'
	CtrlD     rune = '\x04'
)

type Command int

const (
	CommandNone Command = iota
	CommandUp
	CommandDown
)

type LineReader struct {
	prompt string

	cursorPos int
	input     []rune

	buf               [16]byte
	previousTermState *term.State
	signalChan        chan os.Signal
}

func New(prompt string) (*LineReader, error) {
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
		prompt: prompt,

		cursorPos: 0,
		input:     make([]rune, 0),

		buf:               [16]byte{0},
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
func (lr *LineReader) Read() ([]rune, Command, error) {
	// TODO: render the cursor at cursorPos, instead of wherever
	fmt.Print("\033[2K\r> ", string(lr.input))

	bufLen, err := os.Stdin.Read(lr.buf[:])
	if err != nil {
		return nil, CommandNone, err
	}
	bufPart := lr.buf[:bufLen]

	// TODO: magic numbers!
	if slices.Equal(bufPart, []byte{27, 91, 65}) {
		return lr.input, CommandUp, nil
	} else if slices.Equal(bufPart, []byte{27, 91, 66}) {
		return lr.input, CommandDown, nil
	} else if slices.Equal(bufPart, []byte{27, 91, 'C'}) {
		if lr.cursorPos < len(lr.input) {
			lr.cursorPos += 1
		}
	} else if slices.Equal(bufPart, []byte{27, 91, 'D'}) {
		if lr.cursorPos > 0 {
			lr.cursorPos -= 1
		}
	}

	rune, _ := utf8.DecodeRune(bufPart)
	if rune == Backspace {
		if len(lr.input) > 0 {
			lr.input = lr.input[:len(lr.input)-1]
		}
	} else if rune == CtrlC {
		// TODO: better way to handle this than just returning an EOF :/
		// this is not the same thing as EOF (which should be returned through Ctrl+D)
		return nil, CommandNone, io.EOF
	} else if rune == CtrlD {
		return nil, CommandNone, io.EOF
	} else if rune < '\x20' {
		// Intentionally ignore all other control characters,
		// and only accept characters which are symbolic in some way.
	} else {
		// TODO: splice things into cursorPos, instead of just putting them wherever
		lr.input = append(lr.input, rune)
	}
	return lr.input, CommandNone, nil
}
