CREATE TABLE migrations (id INT PRIMARY KEY, current_version INT);

CREATE TABLE tasks (
    id VARCHAR PRIMARY KEY,
    title VARCHAR
);

CREATE TABLE task_links (
	parent_id VARCHAR,
	child_id VARCHAR,
	PRIMARY KEY (parent_id, child_id),
	FOREIGN KEY (parent_id) REFERENCES tasks(id),
	FOREIGN KEY (child_id) REFERENCES tasks(id)
);
