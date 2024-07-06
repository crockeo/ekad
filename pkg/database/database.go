package database

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/crockeo/ekad/pkg/models"
	_ "github.com/mattn/go-sqlite3"
)

var (
	ErrFailedToCreate = errors.New("Failed to create database")
	ErrInvalidID      = errors.New("Task has an invalid ID")
)

type Database struct {
	inner *sql.DB
}

func Open(path string) (*Database, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrFailedToCreate, err)
	}
	return &Database{db}, nil
}

func (db *Database) Migrate() error {
	// TODO: more advanced database migrations :)
	if _, err := db.inner.Exec(`
		CREATE TABLE IF NOT EXISTS tasks (
		    id VARCHAR PRIMARY KEY,
		    title VARCHAR
		)
	`); err != nil {
		return err
	}
	if _, err := db.inner.Exec(`
		CREATE TABLE IF NOT EXISTS task_links (
			parent_id VARCHAR,
			child_id VARCHAR,
			PRIMARY KEY (parent_id, child_id),
			FOREIGN KEY (parent_id) REFERENCES tasks(id),
			FOREIGN KEY (child_id) REFERENCES tasks(id)
		)
	`); err != nil {
		return err
	}
	if _, err := db.inner.Exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS task_titles USING fts4(
			id,
			title
		)
	`); err != nil {
		return err
	}
	return nil
}

// Upsert performs an update/insert on the provided Task.
// The `task` must at least have its `uuid` populated.
// All columns will be replaced with the contents of the Task,
// even if they are empty.
func (db *Database) Upsert(task models.Task) error {
	// TODO: this is just an insert, make it an upsert
	renderedUUID := task.ID.String()
	if renderedUUID == "" {
		return ErrInvalidID
	}
	tx, err := db.inner.Begin()
	defer tx.Rollback()

	if _, err := db.inner.Exec(
		`
		INSERT INTO tasks (
			id,
			title
		) VALUES (
			?,
			?
		)
		`,
		task.ID.String(),
		task.Title,
	); err != nil {
		return err
	}

	if _, err := db.inner.Exec(
		`
		INSERT INTO task_titles (
			id,
			title
		) VALUES (
			?,
			?
		)
		`,
		task.ID.String(),
		task.Title,
	); err != nil {
		return err
	}

	return err
}
