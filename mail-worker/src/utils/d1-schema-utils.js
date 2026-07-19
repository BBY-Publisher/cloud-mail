const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;
const ADD_COLUMN_PATTERN = /^\s*ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+([\s\S]*?)\s*;?\s*$/i;

function assertIdentifier(value) {
	if (!IDENTIFIER_PATTERN.test(value)) {
		throw new Error(`Invalid D1 identifier: ${value}`);
	}
}

export async function tableExists(db, table) {
	assertIdentifier(table);
	return Boolean(await db.prepare(`
		SELECT name
		FROM sqlite_master
		WHERE type = 'table' AND name = ?
		LIMIT 1
	`).bind(table).first());
}

export async function columnExists(db, table, column) {
	assertIdentifier(table);
	assertIdentifier(column);
	return Boolean(await db.prepare(`
		SELECT name
		FROM pragma_table_info('${table}')
		WHERE name = ?
		LIMIT 1
	`).bind(column).first());
}

export async function addColumnIfMissing(db, table, column, definition) {
	assertIdentifier(table);
	assertIdentifier(column);
	if (await columnExists(db, table, column)) {
		return false;
	}

	try {
		await db.prepare(
			`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
		).run();
		return true;
	} catch (error) {
		// Multiple Worker isolates may run the same lazy migration together.
		// Ignore only the race where another isolate added the column.
		if (await columnExists(db, table, column)) {
			return false;
		}
		throw error;
	}
}

export async function runIdempotentMigrationStatements(db, statements) {
	for (const statement of statements) {
		const match = String(statement).match(ADD_COLUMN_PATTERN);
		if (match) {
			await addColumnIfMissing(db, match[1], match[2], match[3]);
			continue;
		}
		await db.prepare(statement).run();
	}
}
