package main

import (
	"cmp"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"slices"
	"strings"

	"github.com/crockeo/ekad/pkg/database"
	"github.com/crockeo/ekad/pkg/linereader"
	"github.com/crockeo/ekad/pkg/models"
	"github.com/google/uuid"
	"github.com/lithammer/fuzzysearch/fuzzy"
	_ "github.com/mattn/go-sqlite3"
	"github.com/urfave/cli/v2"
)

func main() {
	if err := mainImpl(); err != nil {
		log.Fatal(err)
	}
}

func mainImpl() error {
	db, err := database.Open("./.tmp/db.sql")
	if err != nil {
		return err
	}

	if err := db.Migrate(); err != nil {
		return fmt.Errorf("Failed to migrate on startup: %w", err)
	}

	app := &cli.App{
		Name: "ek",
		Commands: []*cli.Command{
			{
				Name:    "list",
				Aliases: []string{"l"},
				Usage:   "List all tasks",
				Action: func(ctx *cli.Context) error {
					return list(ctx, db)
				},
			},
			{
				Name:    "new",
				Aliases: []string{"n"},
				Usage:   "Create a new task",
				Action: func(ctx *cli.Context) error {
					return new(ctx, db)
				},
			},
			{
				Name:    "search",
				Aliases: []string{"s"},
				Usage:   "Search for an existing task by its title",
				Action: func(ctx *cli.Context) error {
					return search(ctx, db)
				},
			},
		},
	}
	return app.Run(os.Args)
}

func list(ctx *cli.Context, db *database.Database) error {
	tasks, err := db.GetAll()
	if err != nil {
		return err
	}
	slices.SortFunc(tasks, func(t1 models.Task, t2 models.Task) int {
		return cmp.Compare(t1.ID.ID(), t2.ID.ID())
	})
	for _, task := range tasks {
		fmt.Println(task.Title)
	}
	return nil
}

func new(ctx *cli.Context, db *database.Database) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	task := models.Task{ID: id, Title: strings.Join(ctx.Args().Slice(), " ")}
	if err := db.Upsert(task); err != nil {
		return err
	}
	fmt.Println("Created task", task)
	return nil
}

func search(ctx *cli.Context, db *database.Database) error {
	// Depending on how well this performs when I have many more potential entries,
	// instead consider something that runs in-SQLite, like spellfix1 and FTS4
	//
	// https://www.sqlite.org/spellfix1.html
	// https://www.sqlite.org/fts3.html
	tasks, err := db.GetAll()
	if err != nil {
		return err
	}

	selected := 0
	targets := make([]string, 0, len(tasks))
	for _, task := range tasks {
		targets = append(targets, task.Title)
	}

	lineReader, err := linereader.New("> ")
	if err != nil {
		return err
	}
	defer lineReader.Close()

	lineReader.Prompt()
	for {
		input, cmd, err := lineReader.Read()
		if errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			return err
		}

		ranks := fuzzy.RankFindNormalizedFold(input, targets)
		if selected >= len(ranks) {
			selected = len(ranks) - 1
		}
		if cmd == linereader.CommandUp && selected > 0 {
			selected -= 1
		} else if cmd == linereader.CommandDown && selected < len(ranks)-1 {
			selected += 1
		}

		lineReader.Prompt()
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
	}

	return nil
}
