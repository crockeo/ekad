export type UUID = string;

export interface Task {
  id: UUID;
  title: string;
  completedAt: Date | null;
  deletedAt: Date | null;
}

export interface Ekad {
  tasks: { [key: UUID]: Task };
}
