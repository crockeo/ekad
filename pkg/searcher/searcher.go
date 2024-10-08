package searcher

import (
	"fmt"

	"github.com/crockeo/ekad/pkg/linereader"
	"github.com/crockeo/ekad/pkg/terminal"
	"github.com/lithammer/fuzzysearch/fuzzy"
)

// Search performs a command-line search of the provided items
// by fuzzy-finding their rendered contents.
func Search[T any](items []T, renderer func(T) string) (T, error) {
	// Depending on how well this performs when I have many more potential entries,
	// instead consider something that runs in-SQLite, like spellfix1 and FTS4
	//
	// https://www.sqlite.org/spellfix1.html
	// https://www.sqlite.org/fts3.html
	var empty T

	selected := 0
	targets := make([]string, len(items))
	for i, item := range items {
		targets[i] = renderer(item)
	}

	lineReader, err := linereader.New("> ")
	if err != nil {
		return empty, err
	}
	defer lineReader.Close()

	origPos, err := prepareSearchSpace(len(items) + 1)
	if err != nil {
		return empty, err
	}
	terminal.SetCursorPos(origPos)

	ranks := fuzzy.RankFindNormalizedFold("", targets)
	for {
		lineReader.Prompt()
		terminal.WithExcursion(func() error {
			for range targets {
				fmt.Print("\n\033[2K")
			}
			return nil
		})
		terminal.WithExcursion(func() error {
			fmt.Print("\n\r")
			for i, rank := range ranks {
				if i == selected {
					fmt.Printf("\033[1m%s\033[22m\n\r", rank.Target)
				} else {
					fmt.Printf("%s\n\r", rank.Target)
				}
			}
			return nil
		})
		input, cmd, err := lineReader.Read()
		if err != nil {
			return empty, err
		}
		if cmd == linereader.CommandExit && len(ranks) > 0 {
			break
		}

		ranks = fuzzy.RankFindNormalizedFold(input, targets)
		if len(ranks) > 0 && selected >= len(ranks) {
			selected = len(ranks) - 1
		}
		if cmd == linereader.CommandUp && selected > 0 {
			selected -= 1
		} else if cmd == linereader.CommandDown && selected < len(ranks)-1 {
			selected += 1
		}

	}

	terminal.SetCursorPos(origPos)
	terminal.WithExcursion(func() error {
		for range targets {
			fmt.Print("\n\033[2K")
		}
		return nil
	})

	selectedRank := ranks[selected]
	return items[selectedRank.OriginalIndex], nil
}

// prepareSearchSpace ensures that there is enough vertical space available to perform searching
// for the number of items that are being searched through.
// If the number of items exceeds the vertical space available on the terminal
// it will instead clear the terminal for searching.
func prepareSearchSpace(requiredSpace int) (terminal.CursorPos, error) {
	cursorPos, err := terminal.GetCursorPos()
	if err != nil {
		return terminal.CursorPos{}, err
	}

	defer terminal.SetCursorPos(cursorPos)
	terminal.SetCursorPos(terminal.CursorPos{
		Row: 999,
		Col: 999,
	})

	maxPos, err := terminal.GetCursorPos()
	if err != nil {
		return terminal.CursorPos{}, err
	}

	availableSpace := maxPos.Row - cursorPos.Row
	if availableSpace >= requiredSpace {
		return cursorPos, nil
	}

	for i := 0; i < requiredSpace-availableSpace; i++ {
		// make space by pushing up the rest of the content!
		fmt.Print("\n")
	}
	return terminal.CursorPos{
		Row: maxPos.Row - requiredSpace,
		Col: cursorPos.Col,
	}, nil
}
