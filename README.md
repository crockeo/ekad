# ekad (ek)

A funny series of letters which has a nice prefix to type: `ek`.

## What

Typically task management software is "list"- or "tree"- based,
this is an attempt at making a graph-based task management software.

- List-based is, as it sounds, just a series of things in a list that you need to accomplish.

- Tree-based is the same as "list-based," except that you can make sub-tasks of tasks
  which must be completed for the super-task to be marked as done.
  These are called tree based because they resemble
  [trees](https://en.wikipedia.org/wiki/Tree_(graph_theory))
  in graph theory.

- Graph-based is the generalization of trees into any
  [directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph).

## Why

I've often been frustrated by the way in which list- or tree-based
task management software fails to capture complexity in real work.
This means I have to keep more information in my head
(e.g. `B` and `C` are subtasks of `A`, but `B` needs to be done before `C` can be started),
and doesn't let me use computers to solve cool problems like
optimal resource allocation for planning.

I'm betting that a graph-based approach will help
to some degree with both of these problems!

Several folks have written about this before,
or implemented versions of this:

- [James Fisher on the TODO DAG](https://jameshfisher.com/2013/12/19/todo-dag/).
- The app [Intention](https://about.i.ntention.app/), which implements a DAG.
- [taskdb](https://github.com/andrey-utkin/taskdb).
- The now-dead masterplan.so, which is [immortalized on Hacker News](https://news.ycombinator.com/item?id=30205699).
- And probably a bunch more!

None of these felt quite right to me,
so I wanted to give in to my hubris
and try to make it myself!

## How

If you have `rust` installed:

```shell
https://github.com/crockeo/ekad
cargo run
```

# License

MIT Open Source License, refer to [LICENSE](./LICENSE) for details.
