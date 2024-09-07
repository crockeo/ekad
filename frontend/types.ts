export type UUID = string;

export interface Task {
  id: UUID;
  x: number;
  y: number;
  title: string;
  description: string;
  completedAt: Date | null;
  deletedAt: Date | null;

  blocks: { [key: UUID]: {} };
  blockedBy: { [key: UUID]: {} };
}

export interface Ekad {
  tasks: { [id: UUID]: Task };
}
