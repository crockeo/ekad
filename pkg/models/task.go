package models

import (
	"time"

	"github.com/google/uuid"
)

type Task struct {
	ID          uuid.UUID
	Title       string
	CompletedAt *time.Time
	DeletedAt   *time.Time
}

func RenderTask(task Task) string {
	return task.Title
}
