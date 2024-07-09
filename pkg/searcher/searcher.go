package searcher

import (
	"errors"
	"fmt"
	"io"

	"github.com/crockeo/ekad/pkg/linereader"
	"github.com/lithammer/fuzzysearch/fuzzy"
)

// Search performs a command-line search of the provided items
// by fuzzy-finding their rendered contents.
func Search[T any](items []T, renderer func(T) string) (*T, error) {
	// TODO: can i replace this entire thing with just like "use fzf as a library"?

	// Depending on how well this performs when I have many more potential entries,
	// instead consider something that runs in-SQLite, like spellfix1 and FTS4
	//
	// https://www.sqlite.org/spellfix1.html
	// https://www.sqlite.org/fts3.html
	selected := 0
	targets := make([]string, len(items))
	for i, item := range items {
		targets[i] = renderer(item)
	}

	lineReader, err := linereader.New("> ")
	if err != nil {
		return nil, err
	}
	defer lineReader.Close()

	origPos, err := linereader.GetCursorPos()
	if err != nil {
		return nil, err
	}

	ranks := fuzzy.RankFindNormalizedFold("", targets)
	for {
		lineReader.Prompt()
		// TODO: render a maximum of <end of terminal> - <cursor position> elements
		// OR instead move the cursor position further up the screen if needed
		lineReader.WithExcursion(func() error {
			for range targets {
				fmt.Print("\n\033[2K")
			}
			return nil
		})
		lineReader.WithExcursion(func() error {
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
		if errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			return nil, err
		}

		ranks = fuzzy.RankFindNormalizedFold(input, targets)
		if len(ranks) > 0 && selected >= len(ranks) {
			selected = len(ranks) - 1
		}
		if cmd == linereader.CommandExit && len(ranks) > 0 {
			break
		} else if cmd == linereader.CommandUp && selected > 0 {
			selected -= 1
		} else if cmd == linereader.CommandDown && selected < len(ranks)-1 {
			selected += 1
		}

	}

	// TODO: bundle this in a better way, so that it's not leaking internals
	// of how we manage the terminal inside of lineReader
	linereader.SetCursorPos(origPos)
	for range targets {
		fmt.Print("\n\033[2K")
	}
	linereader.SetCursorPos(origPos)
	lineReader.Close()

	selectedRank := ranks[selected]
	return &items[selectedRank.OriginalIndex], nil
}
