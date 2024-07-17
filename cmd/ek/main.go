package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"slices"
	"strings"

	"github.com/crockeo/ekad/pkg/database"
	"github.com/crockeo/ekad/pkg/linereader"
	"github.com/crockeo/ekad/pkg/models"
	"github.com/crockeo/ekad/pkg/searcher"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"github.com/urfave/cli/v2"
)

// TODO: add in https://github.com/fatih/color for better visuals

// TODO: in many of these tasks the logic is something like "choose a task out of a candidate set."
// this could be abstracted out into a helper function

func main() {
	if err := mainImpl(); err != nil {
		log.Fatal(err)
	}
}

func mainImpl() error {
	db, err := database.OpenSQLite("./.tmp/db.sql")
	if err != nil {
		return err
	}

	if err := db.Migrate(); err != nil {
		return fmt.Errorf("Failed to migrate on startup: %w", err)
	}

	app := &cli.App{
		Name:           "ek",
		DefaultCommand: "all",
		Commands: []*cli.Command{
			{
				Name:    "all",
				Aliases: []string{"a"},
				Usage:   "List all tasks",
				Action: func(ctx *cli.Context) error {
					return all(ctx, db)
				},
			},
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
				Name:    "goals",
				Aliases: []string{"g"},
				Usage:   "Show active goals",
				Action: func(ctx *cli.Context) error {
					return goals(ctx, db)
				},
			},
			{
				Name:    "inbox",
				Aliases: []string{"i"},
				Usage:   "Show floating tasks with no parent or child",
				Action: func(ctx *cli.Context) error {
					return inbox(ctx, db)
				},
			},
			{
				Name:    "kids",
				Aliases: []string{"k"},
				Usage:   "List the active children of a task",
				Action: func(ctx *cli.Context) error {
					return kids(ctx, db)
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
			{
				Name:    "todo",
				Aliases: []string{"t"},
				Usage:   "Recursively list all actionable children of a task",
				Action: func(ctx *cli.Context) error {
					return todo(ctx, db)
				},
			},
			{
				Name:    "write",
				Aliases: []string{"w"},
				Usage:   "Write a note associated with a task",
				Action: func(ctx *cli.Context) error {
					return write(ctx, db)
				},
			},
		},
	}
	return app.Run(os.Args)
}

func all(ctx *cli.Context, db database.Database) error {
	tasks, err := db.GetAll()
	if err != nil {
		return err
	}
	for _, task := range tasks {
		fmt.Println(task.Title)
	}
	return nil
}

func complete(ctx *cli.Context, db database.Database) error {
	id := ctx.Args().Get(0)

	var task models.Task
	if id != "" {
		uuid, err := uuid.Parse(id)
		if err != nil {
			return err
		}
		foundTask, err := db.Get(uuid)
		if err != nil {
			return err
		}
		task = foundTask
	} else {
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
		task = selectedTask
	}

	if err := db.Complete(task.ID); err != nil {
		return err
	}
	fmt.Printf("Completed `%s`\n", task.Title)

	return nil
}

func delete(ctx *cli.Context, db database.Database) error {
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

func goals(ctx *cli.Context, db database.Database) error {
	goals, err := db.Goals()
	if err != nil {
		return err
	}
	for _, goal := range goals {
		fmt.Println(goal.Title)
	}
	return nil
}

func inbox(ctx *cli.Context, db database.Database) error {
	inbox, err := db.Inbox()
	if err != nil {
		return err
	}
	for _, task := range inbox {
		fmt.Println(task.Title)
	}
	return nil
}

func kids(ctx *cli.Context, db database.Database) error {
	tasks, err := db.GetAll()
	if err != nil {
		return nil
	}
	if len(tasks) == 0 {
		fmt.Println("Not enough tasks to link.")
		return nil
	}

	task, err := searcher.Search[models.Task](tasks, models.RenderTask)
	if err != nil {
		return err
	}

	children, err := db.Children(task.ID)
	if err != nil {
		return err
	}
	for _, child := range children {
		fmt.Println(child.Title)
	}
	return nil
}

func link(ctx *cli.Context, db database.Database) error {
	tasks, err := db.GetAll()
	if err != nil {
		return nil
	}
	if len(tasks) <= 1 {
		fmt.Println("Not enough tasks to link.")
		return nil
	}

	fmt.Println("Choose parent task.")
	parentTask, err := searcher.Search[models.Task](tasks, models.RenderTask)
	if err != nil {
		return err
	}
	fmt.Println(">", parentTask.Title)

	// TODO: also remove every item which is *already* linked from parentTask,
	// since it doesn't make any sense to re-link it

	// We don't want to let someone choose the same task twice,
	// so we remove the task we have already selected
	// from the set of all tasks.
	for i, task := range tasks {
		if task == parentTask {
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

func new(ctx *cli.Context, db database.Database) error {
	title := strings.Join(ctx.Args().Slice(), " ")
	title = strings.TrimSpace(title)
	if title == "" {
		readTitle, err := linereader.ReadLine("Title> ")
		if err != nil {
			return err
		}
		readTitle = strings.TrimSpace(readTitle)
		if readTitle == "" {
			fmt.Println("Cannot make task with empty name.")
			return nil
		}
		title = readTitle
	}

	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	task := models.Task{ID: id, Title: title}
	if err := db.Upsert(task); err != nil {
		return err
	}
	fmt.Println("Created task", task)
	return nil
}

func search(ctx *cli.Context, db database.Database) error {
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
	fmt.Printf("[%s] %s\n", selectedTask.ID, selectedTask.Title)
	if selectedTask.Description != nil && *selectedTask.Description != "" {
		fmt.Println()
		fmt.Print(*selectedTask.Description)
		if !strings.HasSuffix(*selectedTask.Description, "\n") {
			fmt.Println()
		}
	}
	return nil
}

func todo(ctx *cli.Context, db database.Database) error {
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

	todoTasks, err := db.Todo(selectedTask.ID)
	if err != nil {
		return err
	}

	for _, task := range todoTasks {
		fmt.Println(task.Title)
	}

	return nil
}

func write(ctx *cli.Context, db database.Database) error {
	editor, ok := os.LookupEnv("EDITOR")
	if !ok {
		fmt.Println("Cannot run `ek write` without an EDITOR defined.")
		return nil
	}

	tasks, err := db.GetAll()
	if err != nil {
		return err
	}

	selectedTask, err := searcher.Search[models.Task](tasks, models.RenderTask)
	if err != nil {
		return err
	}

	dirName, err := os.MkdirTemp("", "")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dirName)

	fileName := path.Join(dirName, fmt.Sprintf("%s.md", selectedTask.ID.String()))
	var contents []byte
	if selectedTask.Description != nil {
		contents = []byte(*selectedTask.Description)
	}
	if err := os.WriteFile(fileName, contents, 0o644); err != nil {
		return err
	}

	cmd := exec.Command(editor, fileName)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return err
	}

	newContentsSlice, err := os.ReadFile(fileName)
	if err != nil {
		return err
	}
	newContents := string(newContentsSlice)

	selectedTask.Description = &newContents
	return db.Upsert(selectedTask)
}
