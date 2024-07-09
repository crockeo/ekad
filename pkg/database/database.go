package database

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/crockeo/ekad/pkg/models"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

var (
	ErrFailedToCreate = errors.New("Failed to create database")
	ErrInvalidID      = errors.New("Task has an invalid ID")
	ErrMissingTask    = errors.New("No such task")
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
	return nil
}

// Get retrieves a Task from the database with the provided ID.
// If the UUID is invalid, or there is no
func (db *Database) Get(id uuid.UUID) (models.Task, error) {
	row := db.inner.QueryRow(
		`
		SELECT
			id,
			title
		FROM tasks
		WHERE id = ?
		`,
		id.String(),
	)

	task := models.Task{}
	err := row.Scan(
		&task.ID,
		&task.Title,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return models.Task{}, ErrMissingTask
	} else if err != nil {
		return models.Task{}, err
	}

	return task, nil
}

// GetAll returns the total set of Tasks in the database.
// This is useful when one wants to perform a search over all possible tasks.
func (db *Database) GetAll() ([]models.Task, error) {
	rows, err := db.inner.Query(
		`
		SELECT
			id,
			title
		FROM tasks
		`,
	)
	if err != nil {
		return nil, err
	}

	tasks := []models.Task{}
	var task models.Task
	for rows.Next() {
		if err := rows.Scan(
			&task.ID,
			&task.Title,
		); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

// Upsert performs an update/insert on the provided Task.
// The `task` must at least have its `uuid` populated.
// All columns will be replaced with the contents of the Task,
// even if they are empty.
func (db *Database) Upsert(task models.Task) error {
	renderedUUID := task.ID.String()
	if renderedUUID == "" {
		return ErrInvalidID
	}
	tx, err := db.inner.Begin()
	defer tx.Rollback()

	if _, err := db.inner.Exec(
		`
		INSERT OR REPLACE INTO tasks (
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
