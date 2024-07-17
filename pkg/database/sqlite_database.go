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
)

type SQLiteDtabase struct {
	inner *sql.DB
}

func OpenSQLite(path string) (*SQLiteDtabase, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrFailedToCreate, err)
	}
	return &SQLiteDtabase{db}, nil
}

func (db *SQLiteDtabase) Migrate() error {
	return applyPendingMigrations(db.inner)
}

func (db *SQLiteDtabase) Children(id uuid.UUID) ([]models.Task, error) {
	rows, err := db.inner.Query(
		`
		WITH
		  RECURSIVE task_graph(parent_id, current_id) AS (
		    VALUES (NULL, '0190b1e6-d50b-7bee-aa45-e0a57b8f8977')

		    UNION

		    SELECT
		      task_graph.current_id,
		      task_links.child_id
		    FROM task_graph
		    INNER JOIN task_links
		      ON task_graph.current_id = task_links.parent_id
		  )

		SELECT DISTINCT
		  tasks.id,
		  tasks.title,
		  tasks.description,
		  tasks.completed_at,
		  tasks.deleted_at
		FROM tasks
		INNER JOIN task_graph
		  ON tasks.id = task_graph.current_id
		WHERE tasks.id <> ?
		  AND tasks.completed_at IS NULL
		  AND tasks.deleted_at IS NULL
		`,
		id,
		id,
	)
	if err != nil {
		return nil, err
	}
	return scanTasks(rows)
}

func (db *SQLiteDtabase) Complete(id uuid.UUID) error {
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

func (db *SQLiteDtabase) Delete(id uuid.UUID) error {
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
func (db *SQLiteDtabase) Get(id uuid.UUID) (models.Task, error) {
	row := db.inner.QueryRow(
		`
		SELECT
		    id,
		    title,
		    description,
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
func (db *SQLiteDtabase) GetAll() ([]models.Task, error) {
	rows, err := db.inner.Query(
		`
		SELECT
		  id,
		  title,
		  description,
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

func (db *SQLiteDtabase) Goals() ([]models.Task, error) {
	// TODO: at some point see if i can make this less shit :)
	rows, err := db.inner.Query(
		`
		SELECT
		  tasks.id,
		  tasks.title,
		  tasks.description,
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

func (db *SQLiteDtabase) Inbox() ([]models.Task, error) {
	rows, err := db.inner.Query(
		`
		SELECT
		  tasks.id,
		  tasks.title,
		  tasks.description,
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
func (db *SQLiteDtabase) Link(parentID uuid.UUID, childID uuid.UUID) error {
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
func (db *SQLiteDtabase) Upsert(task models.Task) error {
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
		  description,
		  completed_at,
		  deleted_at
		) VALUES (
		  ?,
		  ?,
		  ?,
		  ?,
		  ?
		)
		`,
		task.ID.String(),
		task.Title,
		task.Description,
		task.CompletedAt,
		task.DeletedAt,
	); err != nil {
		return fmt.Errorf("Failed to upsert task: %w", err)
	}
	return err
}

// Todo returns all of all of the leaf nodes reachable by the provided id.
// This corresponds to tasks related to the provided task which are actionable.
func (db *SQLiteDtabase) Todo(id uuid.UUID) ([]models.Task, error) {
	// TODO: run this through a query planner to make sure the `LEFT JOIN ... AS parent_search`
	// section doesn't cause this to have performance issues with large numbers of tasks
	rows, err := db.inner.Query(
		`
		WITH
		  RECURSIVE task_graph(parent_id, current_id) AS (
		    VALUES (NULL, '0190b1e6-d50b-7bee-aa45-e0a57b8f8977')

		    UNION

		    SELECT
		      task_graph.current_id,
		      task_links.child_id
		    FROM task_graph
		    INNER JOIN task_links
		      ON task_graph.current_id = task_links.parent_id
		  )

		SELECT DISTINCT
		  tasks.id,
		  tasks.title,
		  tasks.description,
		  tasks.completed_at,
		  tasks.deleted_at
		FROM tasks
		INNER JOIN task_graph
		  ON tasks.id = task_graph.current_id
		LEFT JOIN task_graph AS parent_search
		  ON tasks.id = parent_search.parent_id
		WHERE tasks.completed_at IS NULL
		  AND tasks.deleted_at IS NULL
		  AND parent_search.parent_id IS NULL;
		`,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("Failed to execute todo query: %w", err)
	}

	tasks, err := scanTasks(rows)
	if err != nil {
		return nil, fmt.Errorf("Failed to scan todo tasks: %w", err)
	}
	return tasks, nil
}

// scanTasks scans a set of rows into an array of models.Tasks.
func scanTasks(rows *sql.Rows) ([]models.Task, error) {
	tasks := []models.Task{}
	var task models.Task
	for rows.Next() {
		if err := rows.Scan(
			&task.ID,
			&task.Title,
			&task.Description,
			&task.CompletedAt,
			&task.DeletedAt,
		); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}
