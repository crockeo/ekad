package main

import (
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

// TODO: add in https://github.com/fatih/color for better visuals

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
				Name:    "complete",
				Aliases: []string{"c"},
				Usage:   "Complete a task",
				Action: func(ctx *cli.Context) error {
					return complete(ctx, db)
				},
			},
			{
				Name:    "delete",
				Aliases: []string{"d"},
				Usage:   "Delete a task",
				Action: func(ctx *cli.Context) error {
					return delete(ctx, db)
				},
			},
			{
				Name:    "link",
				Aliases: []string{"l"},
				Usage:   "Link two tasks togther",
				Action: func(ctx *cli.Context) error {
					return link(ctx, db)
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

func complete(ctx *cli.Context, db *database.Database) error {
	id := ctx.Args().Get(0)
	if id == "" {
		tasks, err := db.GetAll()
		if err != nil {
			return err
		}
		if len(tasks) == 0 {
			fmt.Println("No tasks.")
			return nil
		}

		task, err := searcher.Search[models.Task](tasks, models.RenderTask)
		id = task.ID.String()
	}

	uuid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	if err := db.Complete(uuid); err != nil {
		return err
	}
	fmt.Println("Completed", id)

	return nil
}

func delete(ctx *cli.Context, db *database.Database) error {
	id := ctx.Args().Get(0)
	if id == "" {
		tasks, err := db.GetAll()
		if err != nil {
			return err
		}
		if len(tasks) == 0 {
			fmt.Println("No tasks.")
			return nil
		}

		task, err := searcher.Search[models.Task](tasks, models.RenderTask)
		id = task.ID.String()
	}

	uuid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return db.Delete(uuid)
}

func link(ctx *cli.Context, db *database.Database) error {
	tasks, err := db.GetAll()
	if err != nil {
		return nil
	}
	if len(tasks) <= 1 {
		fmt.Println("Not enough tasks to link.")
	}

	fmt.Println("Choose parent task.")
	parentTask, err := searcher.Search[models.Task](tasks, models.RenderTask)
	if err != nil {
		return err
	}
	fmt.Println(">", parentTask.Title)

	// We don't want to let someone choose the same task twice,
	// so we remove the task we have already selected
	// from the set of all tasks.
	for i, task := range tasks {
		if task == *parentTask {
			slices.Delete(tasks, i, i+1)
			break
		}
	}

	fmt.Println("Choose child task.")
	childTask, err := searcher.Search(tasks, models.RenderTask)
	if err != nil {
		return err
	}
	fmt.Println(">", childTask.Title)

	return db.Link(parentTask.ID, childTask.ID)
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
	if len(tasks) == 0 {
		fmt.Println("No tasks.")
		return nil
	}

	selectedTask, err := searcher.Search[models.Task](tasks, models.RenderTask)
	if err != nil {
		return err
	}
	fmt.Println(selectedTask)
	return nil
}
