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

func (db *Database) Children(id uuid.UUID) ([]models.Task, error) {
	// TODO: make this all transitive children https://www.sqlite.org/lang_with.html
	rows, err := db.inner.Query(
		`
		SELECT tasks.*
		FROM tasks
		INNER JOIN task_links
		  ON tasks.id = task_links.child_id
		WHERE task_links.parent_id = ?
		`,
		id.String(),
	)
	if err != nil {
		return nil, err
	}
	return scanTasks(rows)
}

func (db *Database) Complete(id uuid.UUID) error {
	now := time.Now()
	result, err := db.inner.Exec(
		"UPDATE tasks SET completed_at = ? WHERE id = ?",
		now,
		id,
	)
	if err != nil {
		return fmt.Errorf("Failed to complete task: %w", err)
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
			completed_at,
			deleted_at
		FROM tasks
		WHERE id = ?
		`,
		id.String(),
	)

	task := models.Task{}
	err := row.Scan(
		&task.ID,
		&task.Title,
		&task.CompletedAt,
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
			completed_at,
			deleted_at
		FROM tasks
	    WHERE completed_at IS NULL
	      AND deleted_at IS NULL
		`,
	)
	if err != nil {
		return nil, err
	}
	return scanTasks(rows)
}

func (db *Database) Goals() ([]models.Task, error) {
	// TODO: at some point see if i can make this less shit :)
	rows, err := db.inner.Query(
		`
		SELECT
			tasks.id,
			tasks.title,
			tasks.completed_at,
			tasks.deleted_at
		FROM tasks
		WHERE tasks.completed_at is NULL
		  AND tasks.deleted_at is NULL
		  AND tasks.id IN (
			SELECT task_links.parent_id
			FROM task_links
			INNER JOIN tasks
			  ON tasks.id = task_links.parent_id
			WHERE tasks.completed_at IS NULL
			  AND tasks.deleted_at IS NULL
		  )
		  AND tasks.id NOT IN (
			SELECT task_links.child_id
			FROM task_links
			INNER JOIN tasks
			  ON tasks.id = task_links.child_id
			WHERE tasks.completed_at IS NULL
			  AND tasks.deleted_at IS NULL
		  )
		`,
	)
	if err != nil {
		return nil, fmt.Errorf("Failed to query goals from the database: %w", err)
	}
	return scanTasks(rows)
}

func (db *Database) Inbox() ([]models.Task, error) {
	rows, err := db.inner.Query(
		`
		SELECT
			tasks.id,
			tasks.title,
			tasks.completed_at,
			tasks.deleted_at
		FROM tasks
		WHERE tasks.completed_at IS NULL
		  AND tasks.deleted_at IS NULL
		  AND tasks.id NOT IN (
		  	SELECT parent_id
		  	FROM task_links

		  	UNION

		  	SELECT child_id
		  	FROM task_links
		  )
		`,
	)
	if err != nil {
		return nil, fmt.Errorf("Failed to query inbox from the database: %w", err)
	}
	return scanTasks(rows)
}

// Link links together two tasks, such that
// the task belonging to parentID is marked as depending on
// the task belonging to childID.
func (db *Database) Link(parentID uuid.UUID, childID uuid.UUID) error {
	// TODO: before we commit this, make sure that we're not creating a cycle in our tasks
	_, err := db.inner.Exec(
		`
		INSERT OR REPLACE INTO task_links (
			parent_id,
			child_id
		) VALUES (
			?,
			?
		)
		`,
		parentID,
		childID,
	)
	if err != nil {
		return fmt.Errorf("Failed to connect task parent %s -> %s child: %w", parentID.String(), childID.String(), err)
	}
	return nil
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
			completed_at,
			deleted_at
		) VALUES (
			?,
			?,
			?,
			?
		)
		`,
		task.ID.String(),
		task.Title,
		task.CompletedAt,
		task.DeletedAt,
	); err != nil {
		return fmt.Errorf("Failed to upsert task: %w", err)
	}
	return err
}

// scanTasks scans a set of rows into an array of models.Tasks.
func scanTasks(rows *sql.Rows) ([]models.Task, error) {
	tasks := []models.Task{}
	var task models.Task
	for rows.Next() {
		if err := rows.Scan(
			&task.ID,
			&task.Title,
			&task.CompletedAt,
			&task.DeletedAt,
		); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}
