package terminal

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCursorPos(t *testing.T) {
	pos, err := parseCursorPos([]byte("\033[17;31R"))
	require.NoError(t, err)
	assert.Equal(t, CursorPos{
		Row: 17,
		Col: 31,
	}, pos)
}
