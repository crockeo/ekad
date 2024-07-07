package linereader

import (
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
)

var (
	ErrInvalidCursorPos = errors.New("Invalid cursor pos")
)

type CursorPos struct {
	Row int
	Col int
}

func setCursorPos(cursorPos CursorPos) {
	fmt.Printf("\033[%d;%dH", cursorPos.Row, cursorPos.Col)
}

func getCursorPos() (CursorPos, error) {
	// Magic string -> get the terminal to print cursor position to stdin
	fmt.Print("\033[6n")

	var buf [32]byte
	bufLen, err := os.Stdin.Read(buf[:])
	if err != nil {
		return CursorPos{}, err
	}
	bufPart := buf[:bufLen]

	return parseCursorPos(bufPart)
}

var cursorPosRe = regexp.MustCompile("^\033\\[(?P<row>\\d+);(?P<col>\\d+)R$")

func parseCursorPos(buf []byte) (CursorPos, error) {
	matches := cursorPosRe.FindSubmatch(buf)
	if matches == nil {
		return CursorPos{}, fmt.Errorf("%s: failed to match", ErrInvalidCursorPos)
	}

	row, err := strconv.Atoi(string(matches[1]))
	if err != nil {
		return CursorPos{}, fmt.Errorf("%w: Non-numeric row", ErrInvalidCursorPos)
	}
	col, err := strconv.Atoi(string(matches[2]))
	if err != nil {
		return CursorPos{}, fmt.Errorf("%w: Non-numeric col", ErrInvalidCursorPos)
	}

	return CursorPos{Row: row, Col: col}, nil
}
