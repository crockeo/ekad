package database

import (
	"database/sql"
	"embed"
	"fmt"
	"path"
	"strconv"
	"strings"
)

//go:embed migrations/*
var content embed.FS

func getCurrentVersion(db *sql.DB) (int, error) {
	row := db.QueryRow("SELECT current_version FROM migrations WHERE id = 0")
	var version int
	if err := row.Scan(&version); err != nil {
		if err.Error() == "no such table: migrations" {
			return 0, nil
		}
		return -1, fmt.Errorf("failed to get current version: %w", err)
	}
	return version, nil
}

func parseMigrationVersion(name string) (int, error) {
	parts := strings.Split(name, "_")
	version, err := strconv.Atoi(parts[0])
	if err != nil {
		return -1, fmt.Errorf("failed to parse migration version: %w", err)
	}
	return version, nil
}

func applyMigration(db *sql.DB, version int, contents []byte) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin migration transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(string(contents)); err != nil {
		return fmt.Errorf("failed to execute migration: %w", err)
	}
	if _, err := tx.Exec(
		"INSERT OR REPLACE INTO migrations (id, current_version) VALUES (0, ?)",
		version,
	); err != nil {
		return fmt.Errorf("failed to update migration version: %w", err)
	}

	return tx.Commit()
}

func applyPendingMigrations(db *sql.DB) error {
	currentVersion, err := getCurrentVersion(db)
	if err != nil {
		return err
	}

	entries, err := content.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read all migrations: %w", err)
	}
	for _, entry := range entries {
		name := entry.Name()
		version, err := parseMigrationVersion(name)
		if err != nil {
			return err
		} else if version <= currentVersion {
			continue
		}

		contents, err := content.ReadFile(path.Join("migrations", name))
		if err != nil {
			return fmt.Errorf("failed to read migration: %w", err)
		}
		if err := applyMigration(db, version, contents); err != nil {
			return err
		}
	}

	return nil
}
