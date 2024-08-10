use anyhow::bail;
use automerge::{transaction::Transactable, AutoCommit, ObjType, ReadDoc};
use masonry::Point;
use petgraph::graph::{DiGraph, NodeIndex as PetgraphNodeIndex};
use std::{borrow::Cow, str::FromStr};
use uuid::Uuid;

#[derive(Clone, Copy, PartialEq)]
pub struct Node {
    uuid: Uuid,
    point: Point,
}

impl Node {
    pub fn new(point: Point) -> Self {
        Node {
            uuid: Uuid::now_v7(),
            point,
        }
    }
}

pub type NodeIndex = usize;

pub trait Graph<Node> {
    fn add_edge(&mut self, from: NodeIndex, to: NodeIndex) -> anyhow::Result<()>;
    fn add_node(&mut self, node: Node) -> anyhow::Result<NodeIndex>;
    fn get_node(&self, index: NodeIndex) -> anyhow::Result<&Node>;
    // TODO: make these some kind of iterator that won't need us to do heap allocation all the time
    fn neighbors(&self, index: NodeIndex) -> anyhow::Result<Vec<NodeIndex>>;
    fn node_indices(&self) -> anyhow::Result<Vec<NodeIndex>>;
    fn set_node(&mut self, index: NodeIndex, node: Node) -> anyhow::Result<()>;
}

#[derive(Default)]
pub struct PetgraphGraph<Node>(DiGraph<Node, (), NodeIndex>);

impl<Node> Graph<Node> for PetgraphGraph<Node> {
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

// pub struct AutomergeGraph {
//     doc: AutoCommit,
// }

// impl AutomergeGraph {
//     pub fn new() -> anyhow::Result<Self> {
//         let mut doc = AutoCommit::new();
//         doc.put_object(automerge::ROOT, "nodes", ObjType::Map)?;
//         doc.put_object(automerge::ROOT, "edges", ObjType::Map)?;
//         Ok(Self { doc })
//     }

//     fn get_nodes_object(&self) -> anyhow::Result<(automerge::Value, automerge::ObjId)> {
//         let Some((map, nodes_id)) = self.doc.get(automerge::ROOT, "nodes")? else {
//             bail!("Failed to find `nodes` in Graph");
//         };
//         return Ok((map, nodes_id));
//     }

//     fn get_f64(
//         &self,
//         node_id: &automerge::ObjId,
//         field_id: impl AsRef<str>,
//     ) -> anyhow::Result<f64> {
//         let field_id = field_id.as_ref();
//         let Some((value, _)) = self.doc.get(&node_id, field_id)? else {
//             bail!("Failed to find field `{field_id:?}` on node `{node_id:?}`");
//         };

//         let automerge::Value::Scalar(scalar) = value else {
//             bail!("Field `{field_id:?}` on node `{node_id:?}` is not a scalar.");
//         };

//         let num = match scalar {
//             Cow::Borrowed(automerge::ScalarValue::F64(num)) => *num,
//             Cow::Owned(automerge::ScalarValue::F64(num)) => num,
//             _ => bail!("Field `{field_id:?}` on node `{node_id:?}` is not an f64."),
//         };

//         Ok(num)
//     }

//     pub fn add_node(&mut self, node: Node) -> anyhow::Result<()> {
//         let (_, nodes_id) = self.get_nodes_object()?;

//         let node_id = self
//             .doc
//             .put_object(nodes_id, node.uuid.to_string(), ObjType::Map)?;
//         self.doc.put(&node_id, "x", node.point.x)?;
//         self.doc.put(&node_id, "y", node.point.y)?;

//         Ok(())
//     }

//     pub fn get_node(&self, key: impl AsRef<str>) -> anyhow::Result<Node> {
//         let key = key.as_ref();

//         let (_, nodes_id) = self.get_nodes_object()?;
//         let Some((_, node_id)) = self.doc.get(nodes_id, key)? else {
//             bail!("Failed to find node with ID {key:?}");
//         };

//         Ok(Node {
//             uuid: Uuid::from_str(key)?,
//             point: Point::new(self.get_f64(&node_id, "x")?, self.get_f64(&node_id, "y")?),
//         })
//     }

//     // TODO: I'm going to use this for rendering,
//     // but in the current form I have to make a full Vec and return it each time.
//     // Consider instead building this as an iterator:
//     //
//     // - Iterate through keys without heap allocation
//     // - At each key build a Node on the stack
//     // - And then yield that
//     pub fn get_nodes(&self) -> anyhow::Result<Vec<Node>> {
//         let (_, nodes_id) = self.get_nodes_object()?;
//         let mut nodes = vec![];
//         for node_id in self.doc.keys(nodes_id) {
//             nodes.push(self.get_node(&node_id)?);
//         }
//         Ok(nodes)
//     }
// }

// #[cfg(test)]
// mod tests {
//     use super::*;

//     fn assert_nodes_equal(node1: &Node, node2: &Node) {
//         assert_eq!(node1.uuid, node2.uuid);
//         assert!((node1.point - node2.point).length() < 0.0001);
//     }

//     #[test]
//     fn test_add_node() -> anyhow::Result<()> {
//         let mut graph = AutomergeGraph::new()?;
//         graph.add_node(Node::new(Point::new(1.0, 1.0)))?;
//         Ok(())
//     }

//     #[test]
//     fn test_get_node() -> anyhow::Result<()> {
//         let mut graph = AutomergeGraph::new()?;
//         let original_node = Node::new(Point::new(1.0, 1.0));
//         graph.add_node(original_node)?;
//         let node = graph.get_node(&original_node.uuid.to_string())?;
//         assert_nodes_equal(&original_node, &node);
//         Ok(())
//     }

//     #[test]
//     fn test_nodes() -> anyhow::Result<()> {
//         let mut graph = AutomergeGraph::new()?;
//         let node = Node::new(Point::new(1.0, 1.0));
//         graph.add_node(node)?;
//         let nodes = graph.get_nodes()?;
//         assert_nodes_equal(&node, &nodes[0]);
//         Ok(())
//     }
// }
