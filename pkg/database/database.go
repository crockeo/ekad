package database

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

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
	return applyPendingMigrations(db.inner)
}

func (db *Database) Delete(id uuid.UUID) error {
	now := time.Now()
	result, err := db.inner.Exec(
		"UPDATE tasks SET deleted_at = ? WHERE id = ?",
		now,
		id,
	)
	if err != nil {
		return fmt.Errorf("Failed to delete task: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrMissingTask
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
			title,
			deleted_at
		FROM tasks
		WHERE id = ?
		  AND deleted_at IS NULL
		`,
		id.String(),
	)

	task := models.Task{}
	err := row.Scan(
		&task.ID,
		&task.Title,
		&task.DeletedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return models.Task{}, ErrMissingTask
	} else if err != nil {
		return models.Task{}, fmt.Errorf("Failed to get task: %w", err)
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
			title,
			deleted_at
		FROM tasks
	    WHERE deleted_at IS NULL
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
			&task.DeletedAt,
		); err != nil {
			return nil, fmt.Errorf("Failed to get all tasks: %w", err)
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
			title,
			deleted_at
		) VALUES (
			?,
			?,
			?
		)
		`,
		task.ID.String(),
		task.Title,
		task.DeletedAt,
	); err != nil {
		return fmt.Errorf("Failed to upsert task: %w", err)
	}
	return err
}
