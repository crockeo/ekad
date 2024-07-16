package linereader

import (
	"fmt"

	"github.com/crockeo/ekad/pkg/terminal"
)

func ReadLine(prompt string) (string, error) {
	// TODO: a lot of this is duplicated with the searcher implementation
	// which smells to me like leaking abstractions from inside of LineReader.
	// see if i can consolidate
	lineReader, err := New(prompt)
	if err != nil {
		return "", fmt.Errorf("Failed to construct LineReader: %w", err)
	}
	defer lineReader.Close()

	origPos, err := terminal.GetCursorPos()
	if err != nil {
		return "", fmt.Errorf("Failed to read current position: %w", err)
	}

	for {
		lineReader.Prompt()
		input, cmd, err := lineReader.Read()
		if err != nil {
			return "", err
		} else if cmd == CommandExit {
			terminal.SetCursorPos(origPos)
			fmt.Print("\n\033[2K")
			return input, nil
		}
	}
}
