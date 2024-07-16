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
	CtrlA     rune = '\x01'
	CtrlC     rune = '\x03'
	CtrlD     rune = '\x04'
	CtrlE     rune = '\x05'

	Escape byte = '\x1b'
)

type Command int

const (
	CommandNone Command = iota
	CommandExit
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
		signal.Stop(signalChan)
		syscall.Kill(syscall.Getpid(), syscall.SIGINT)
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

func (lr *LineReader) Prompt() {
	fmt.Printf("\033[2K\r%s%s", lr.prompt, string(lr.input))
	fmt.Printf("\033[%dG", lr.cursorPos+len(lr.prompt)+1)
}

// Read reads a single character from the user's input,
// and then returns the current input.
// Note that for certain actions (e.g. moving the cursor)
// the input returned by Read may be the same as the previous input.
// It is up to the caller to deduplicate responses if they care to.
func (lr *LineReader) Read() (string, Command, error) {
	bufLen, err := os.Stdin.Read(lr.buf[:])
	if err != nil {
		return "", CommandNone, err
	}
	bufPart := lr.buf[:bufLen]

	if slices.Equal(bufPart, []byte{Escape, '[', 'A'}) {
		return string(lr.input), CommandUp, nil
	} else if slices.Equal(bufPart, []byte{Escape, '[', 'B'}) {
		return string(lr.input), CommandDown, nil
	} else if slices.Equal(bufPart, []byte{Escape, '[', 'C'}) {
		if lr.cursorPos < len(lr.input) {
			lr.cursorPos += 1
		}
	} else if slices.Equal(bufPart, []byte{Escape, '[', 'D'}) {
		if lr.cursorPos > 0 {
			lr.cursorPos -= 1
		}
	}

	rune, _ := utf8.DecodeRune(bufPart)
	if rune == Backspace {
		if lr.cursorPos > 0 {
			lr.input = slices.Delete(lr.input, lr.cursorPos-1, lr.cursorPos)
			lr.cursorPos -= 1
		}
	} else if rune == CtrlA {
		lr.cursorPos = 0
	} else if rune == CtrlC {
		syscall.Kill(syscall.Getpid(), syscall.SIGINT)
	} else if rune == CtrlD {
		return "", CommandNone, io.EOF
	} else if rune == CtrlE {
		lr.cursorPos = len(lr.input)
	} else if rune == '\r' || rune == '\n' {
		return string(lr.input), CommandExit, nil
	} else if rune < '\x20' {
		// Intentionally ignore all other control characters,
		// and only accept characters which are symbolic in some way.
	} else {
		lr.input = slices.Insert(lr.input, lr.cursorPos, rune)
		lr.cursorPos += 1
	}
	return string(lr.input), CommandNone, nil
}
