package database

import (
	"errors"

	"github.com/crockeo/ekad/pkg/models"
	"github.com/google/uuid"
)

var (
	ErrInvalidID   = errors.New("Task has an invalid ID")
	ErrMissingTask = errors.New("No such task")
	ErrTaskCycle   = errors.New("A task cycle would be created")
)

type Database interface {
	// Children recursively traverses the graph of tasks
	// and returns all tasks which are the children
	// of the task belonging to the provided ID.
	//
	// If the provided ID is invalid (aka, empty and would produce ""),
	// this should return `ErrInvalidID`.
	//
	// If no such task exists, or that task is already deleted,
	// this should return `ErrMissingTask`.
	Children(id uuid.UUID) ([]models.Task, error)

	// Complete marks the task belonging to the provided ID as complete.
	//
	// If the provided ID is invalid (aka, empty and would produce ""),
	// this should return `ErrInvalidID`.
	//
	// If no such task exists, or that task is already deleted,
	// this should return `ErrMissingTask`.
	Complete(id uuid.UUID) error

	// Delete marks the task belonging to the provided ID as deleted.
	//
	// If the provided ID is invalid (aka, empty and would produce ""),
	// this should return `ErrInvalidID`.
	//
	// If no such task exists this should return `ErrMissingTask`.
	Delete(id uuid.UUID) error

	// Get returns the models.Task belonging to the provided ID.
	//
	// If the provided ID is invalid (aka, empty and would produce ""),
	// this should return `ErrInvalidID`.
	//
	// If no such task exists this should return `ErrMissingTask`.
	Get(id uuid.UUID) (models.Task, error)

	// GetAll returns every `models.Task` which is active
	// (not completed, not deleted).
	GetAll() ([]models.Task, error)

	// Goals returns the set of `models.Task`s which are parents of other tasks,
	// but are not depended on by another tasks.
	Goals() ([]models.Task, error)

	// Inbox returns the set of `models.Task`s which are
	// neither parents nor children of other tasks.
	Inbox() ([]models.Task, error)

	// Link inserts a connection between the task belonging to `parentID`
	// and the task belonging to `childID`.
	//
	// If linking this parent/child pair would create a cycle in the task graph
	// this function should return `ErrTaskCycle`.
	Link(parentID uuid.UUID, childID uuid.UUID) error

	// Todo recursively traverses the graph of tasks
	// and returns all leaf tasks in which children
	// of the task belonging to `id`.
	//
	// If the provided ID is invalid (aka, empty and would produce ""),
	// this should return `ErrInvalidID`.
	//
	// If no such task exists, or that task is already deleted,
	// this should return `ErrMissingTask`.
	Todo(id uuid.UUID) ([]models.Task, error)

	// Upsert inserts or replaces the provided task in the database.
	Upsert(task models.Task) error
}
