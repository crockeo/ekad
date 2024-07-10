package database

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrationNames(t *testing.T) {
	var errors []string

	entries, err := content.ReadDir("migrations")
	require.NoError(t, err)

	migrationsByVersion := map[int][]string{}
	for _, entry := range entries {
		name := entry.Name()
		version, err := parseMigrationVersion(name)
		if err != nil {
			errors = append(errors, fmt.Sprintf("failed to parse `%s`: %s", name, err.Error()))
			continue
		}
		if _, ok := migrationsByVersion[version]; !ok {
			migrationsByVersion[version] = []string{}
		}
		migrationsByVersion[version] = append(migrationsByVersion[version], name)
	}

	for version, migrations := range migrationsByVersion {
		if len(migrations) <= 1 {
			continue
		}
		renderedMigrations := strings.Join(migrations, ", ")
		errors = append(errors, fmt.Sprintf("multiple migrations found for version %d: { %s }", version, renderedMigrations))
	}

	assert.Empty(t, errors)
}
