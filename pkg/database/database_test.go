package database

import (
	"os"
	"path"
	"testing"

	"github.com/crockeo/ekad/pkg/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDatabase(t *testing.T) *Database {
	dir, err := os.MkdirTemp("", "test-ekad")
	require.NoError(t, err)
	t.Cleanup(func() {
		os.RemoveAll(dir)
	})

	db, err := Open(path.Join(dir, "db.sqlite3"))
	require.NoError(t, err)

	require.NoError(t, db.Migrate())

	return db
}

func TestGet_Missing(t *testing.T) {
	db := testDatabase(t)
	_, err := db.Get(uuid.New())
	assert.ErrorIs(t, err, ErrMissingTask)
}

func TestGetAll_Missing(t *testing.T) {
	db := testDatabase(t)
	tasks, err := db.GetAll()
	require.NoError(t, err)
	assert.Equal(t, []models.Task{}, tasks)
}

func TestGetAll(t *testing.T) {
	db := testDatabase(t)

	task := models.Task{
		ID:    uuid.New(),
		Title: "this is a task",
	}
	require.NoError(t, db.Upsert(task))

	tasks, err := db.GetAll()
	require.NoError(t, err)
	assert.Equal(t, []models.Task{task}, tasks)
}

func TestUpsert_New(t *testing.T) {
	db := testDatabase(t)

	task := models.Task{
		ID:    uuid.New(),
		Title: "this is a task",
	}
	require.NoError(t, db.Upsert(task))

	foundTask, err := db.Get(task.ID)
	require.NoError(t, err)
	assert.Equal(t, task, foundTask)
}

func TestUpsert_Replace(t *testing.T) {
	db := testDatabase(t)

	task := models.Task{
		ID:    uuid.New(),
		Title: "this is a task",
	}
	require.NoError(t, db.Upsert(task))

	updatedTask := models.Task{
		ID:    task.ID,
		Title: "this is a new title",
	}
	require.NoError(t, db.Upsert(updatedTask))

	foundTask, err := db.Get(task.ID)
	require.NoError(t, err)
	assert.Equal(t, updatedTask, foundTask)
}
