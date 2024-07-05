package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"unicode/utf8"

	"github.com/crockeo/ekad/pkg/database"
	"github.com/crockeo/ekad/pkg/models"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"github.com/urfave/cli/v2"
	"golang.org/x/term"
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
	// Prepare terminal for raw input
	oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		log.Fatal(err)
	}
	defer term.Restore(int(os.Stdin.Fd()), oldState)

	// Handle interrupts to restore terminal state on exit
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		term.Restore(int(os.Stdin.Fd()), oldState)
		os.Exit(1)
	}()

	// Read and process user input
	var input []rune
	fmt.Print("> ")
	for {
		var buf [1]byte
		os.Stdin.Read(buf[:])
		r, _ := utf8.DecodeRune(buf[:])
		if r == '\x03' {
			break
		} else if r == '\r' || r == '\n' {
			break
		} else if r == 127 { // Handle backspace
			if len(input) > 0 {
				input = input[:len(input)-1]
			}
		} else {
			input = append(input, r)
		}
		fmt.Print("\033[2K\r> " + string(input))
	}

	return nil
}
