package main

import (
	"cmp"
	"fmt"
	"log"
	"os"
	"slices"
	"strings"

	"github.com/crockeo/ekad/pkg/database"
	"github.com/crockeo/ekad/pkg/models"
	"github.com/crockeo/ekad/pkg/searcher"
	"github.com/google/uuid"
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
	tasks, err := db.GetAll()
	if err != nil {
		return err
	}
	selectedTask, err := searcher.Search[models.Task](tasks, func(task models.Task) string {
		return task.Title
	})
	if err != nil {
		return err
	}
	fmt.Println(selectedTask)
	return nil
}
