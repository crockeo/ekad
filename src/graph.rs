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
    fn get_node(&self, index: NodeIndex) -> anyhow::Result<&Node>;
    // TODO: make these some kind of iterator that won't need us to do heap allocation all the time
    fn neighbors(&self, index: NodeIndex) -> anyhow::Result<Vec<NodeIndex>>;
    fn node_indices(&self) -> anyhow::Result<Vec<NodeIndex>>;
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

    fn get_node(&self, index: NodeIndex) -> anyhow::Result<&Node> {
        let node: &Node = &self.0[PetgraphNodeIndex::from(index)];
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

    fn set_node(&mut self, index: NodeIndex, node: Node) -> anyhow::Result<()> {
        self.0[PetgraphNodeIndex::from(index)] = node;
        Ok(())
    }
}

pub struct DatabaseGraph {
    conn: Connection,
}

impl DatabaseGraph {
    pub fn open_in_memory() -> anyhow::Result<Self> {
        let conn = Connection::open_in_memory()?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&mut self) -> anyhow::Result<()> {
        todo!()
    }
}

impl Graph for DatabaseGraph {
    fn add_edge(&mut self, from: NodeIndex, to: NodeIndex) -> anyhow::Result<()> {
        todo!()
    }

    fn add_node(&mut self, node: Node) -> anyhow::Result<NodeIndex> {
        todo!()
    }

    fn get_node(&self, index: NodeIndex) -> anyhow::Result<&Node> {
        todo!()
    }

    fn neighbors(&self, index: NodeIndex) -> anyhow::Result<Vec<NodeIndex>> {
        todo!()
    }

    fn node_indices(&self) -> anyhow::Result<Vec<NodeIndex>> {
        todo!()
    }

    fn set_node(&mut self, index: NodeIndex, node: Node) -> anyhow::Result<()> {
        todo!()
    }
}
