use std::path::Path;

use masonry::Point;
use petgraph::graph::{DiGraph, NodeIndex as PetgraphNodeIndex};
use rusqlite::Connection;
use vello::kurbo::Circle;

#[derive(Clone, Copy, PartialEq)]
pub struct Node {
    pub circle: Circle,
}

pub type NodeIndex = usize;

pub trait Graph {
    fn add_edge(&mut self, from: NodeIndex, to: NodeIndex) -> anyhow::Result<()>;
    fn add_node(&mut self, node: Node) -> anyhow::Result<NodeIndex>;
    fn get_node(&self, index: NodeIndex) -> anyhow::Result<Node>;
    // TODO: make these some kind of iterator that won't need us to do heap allocation all the time
    fn neighbors(&self, index: NodeIndex) -> anyhow::Result<Vec<NodeIndex>>;
    fn node_indices(&self) -> anyhow::Result<Vec<NodeIndex>>;
    fn remove_node(&mut self, index: NodeIndex) -> anyhow::Result<()>;
    fn set_node(&mut self, index: NodeIndex, node: Node) -> anyhow::Result<()>;
}

#[derive(Default)]
pub struct PetgraphGraph(DiGraph<Node, (), NodeIndex>);

impl Graph for PetgraphGraph {
    fn add_edge(&mut self, from: NodeIndex, to: NodeIndex) -> anyhow::Result<()> {
        self.0.update_edge(from.into(), to.into(), ());
        Ok(())
    }

    fn add_node(&mut self, node: Node) -> anyhow::Result<NodeIndex> {
        let index = self.0.add_node(node);
        Ok(index.index())
    }

    fn get_node(&self, index: NodeIndex) -> anyhow::Result<Node> {
        let node: Node = self.0[PetgraphNodeIndex::from(index)];
        Ok(node)
    }

    fn neighbors(&self, index: NodeIndex) -> anyhow::Result<Vec<NodeIndex>> {
        Ok(self
            .0
            .neighbors(index.into())
            .map(PetgraphNodeIndex::index)
            .collect())
    }

    fn node_indices(&self) -> anyhow::Result<Vec<NodeIndex>> {
        Ok(self
            .0
            .node_indices()
            .map(PetgraphNodeIndex::index)
            .collect())
    }

    fn remove_node(&mut self, index: NodeIndex) -> anyhow::Result<()> {
        self.0.remove_node(index.into());
        Ok(())
    }

    fn set_node(&mut self, index: NodeIndex, node: Node) -> anyhow::Result<()> {
        self.0[PetgraphNodeIndex::from(index)] = node;
        Ok(())
    }
}

pub struct DatabaseGraph {
    conn: Connection,
}

impl Default for DatabaseGraph {
    fn default() -> Self {
        // Self::open_in_memory().expect("Failed to open DatabaseGraph in memory.")
        Self::open(".tmp/db.sqlite").expect("Failed to open DatabaseGraph at .tmp/dbsqlite")
    }
}

impl DatabaseGraph {
    pub fn open(path: impl AsRef<Path>) -> anyhow::Result<Self> {
        let conn = Connection::open(path.as_ref())?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> anyhow::Result<Self> {
        let conn = Connection::open_in_memory()?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&mut self) -> anyhow::Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                radius REAL NOT NULL,
                deleted_at DATETIME DEFAULT NULL,
                completed_at DATETIME DEFAULT NULL,
                description VARCHAR DEFAULT NULL
            );
            CREATE TABLE IF NOT EXISTS task_links (
            	parent_id INTEGER NOT NULL,
            	child_id INTEGER NOT NULL,
            	PRIMARY KEY (parent_id, child_id),
            	FOREIGN KEY (parent_id) REFERENCES tasks(id),
            	FOREIGN KEY (child_id) REFERENCES tasks(id)
            );
            "#,
        )?;
        Ok(())
    }
}

impl Graph for DatabaseGraph {
    fn add_edge(&mut self, from: NodeIndex, to: NodeIndex) -> anyhow::Result<()> {
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO task_links (
                parent_id,
                child_id
            ) VALUES (
                ?,
                ?
            )
            "#,
            (from, to),
        )?;
        Ok(())
    }

    fn add_node(&mut self, node: Node) -> anyhow::Result<NodeIndex> {
        self.conn.execute(
            r#"
            INSERT INTO tasks (
                title,
                x,
                y,
                radius
            ) VALUES (
                '',
                ?,
                ?,
                ?
            )
            "#,
            (
                node.circle.center.x,
                node.circle.center.y,
                node.circle.radius,
            ),
        )?;
        Ok(self.conn.last_insert_rowid() as usize)
    }

    fn get_node(&self, index: NodeIndex) -> anyhow::Result<Node> {
        let mut stmt = self
            .conn
            .prepare("SELECT x, y, radius FROM tasks WHERE id = ?")?;
        let node: Node = stmt.query_row((index,), |row| {
            Ok(Node {
                circle: Circle::new(Point::new(row.get("x")?, row.get("y")?), row.get("radius")?),
            })
        })?;
        Ok(node)
    }

    fn neighbors(&self, index: NodeIndex) -> anyhow::Result<Vec<NodeIndex>> {
        let mut stmt = self
            .conn
            .prepare("SELECT child_id FROM task_links WHERE parent_id = ?")?;
        let mut rows = stmt.query((index,))?;
        let mut indices = vec![];
        while let Some(row) = rows.next()? {
            indices.push(row.get("child_id")?);
        }
        Ok(indices)
    }

    fn node_indices(&self) -> anyhow::Result<Vec<NodeIndex>> {
        let mut stmt = self.conn.prepare("SELECT id FROM tasks")?;
        let mut rows = stmt.query(())?;
        let mut indices = vec![];
        while let Some(row) = rows.next()? {
            indices.push(row.get("id")?);
        }
        Ok(indices)
    }

    fn remove_node(&mut self, index: NodeIndex) -> anyhow::Result<()> {
        self.conn.execute(
            r#"
            DELETE FROM tasks WHERE id == ?
            "#,
            (index,),
        )?;
        Ok(())
    }

    fn set_node(&mut self, index: NodeIndex, node: Node) -> anyhow::Result<()> {
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO tasks (
                id,
                title,
                x,
                y,
                radius
            ) VALUES (
                ?,
                '',
                ?,
                ?,
                ?
            )
            "#,
            (
                index,
                node.circle.center.x,
                node.circle.center.y,
                node.circle.radius,
            ),
        )?;
        Ok(())
    }
}
