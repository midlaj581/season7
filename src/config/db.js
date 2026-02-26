const mysql = require('mysql2/promise');
const { URL } = require('url');

let pool;

function getEnv(name, fallback) {
  return process.env[name] || fallback;
}

function toBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

function parseJSON(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function assertDbName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error('DB_NAME must contain only letters, numbers, and underscore.');
  }
}

function parseUrlOptions(rawUrl) {
  const parsed = new URL(rawUrl);
  const options = {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database: decodeURIComponent((parsed.pathname || '/').replace(/^\//, '')),
    waitForConnections: true,
    connectionLimit: 10,
  };

  if (!options.database) {
    options.database = getEnv('DB_NAME', 'auction_system');
  }

  if (toBool(getEnv('DB_SSL', 'false'))) {
    options.ssl = { rejectUnauthorized: false };
  }

  return options;
}

function getDbOptions(includeDatabase = true, forceNoDatabase = false) {
  const dbUrl = getEnv('DATABASE_URL', '') || getEnv('MYSQL_URL', '');
  if (dbUrl) {
    const urlOptions = parseUrlOptions(dbUrl);
    if (forceNoDatabase) delete urlOptions.database;
    if (!includeDatabase) delete urlOptions.database;
    return urlOptions;
  }

  const dbName = getEnv('DB_NAME', 'auction_system');
  if (includeDatabase) assertDbName(dbName);

  const options = {
    host: getEnv('DB_HOST', '127.0.0.1'),
    port: Number(getEnv('DB_PORT', '3306')),
    user: getEnv('DB_USER', 'root'),
    password: getEnv('DB_PASSWORD', ''),
    waitForConnections: true,
    connectionLimit: 10,
  };

  if (includeDatabase) {
    options.database = dbName;
  }

  if (toBool(getEnv('DB_SSL', 'false'))) {
    options.ssl = { rejectUnauthorized: false };
  }

  return options;
}

async function ensureColumn(table, column, ddl) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );

  if (!rows[0]?.c) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

async function connectDB() {
  const fullOptions = getDbOptions(true);
  const { database } = fullOptions;

  // Some managed DB users cannot create databases; attempt and continue on access errors.
  if (!getEnv('DATABASE_URL', '') && !getEnv('MYSQL_URL', '')) {
    const bootstrap = mysql.createPool(getDbOptions(false, true));
    try {
      await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    } catch (error) {
      const denied = ['ER_DBACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR'].includes(error.code);
      if (!denied) throw error;
    } finally {
      await bootstrap.end();
    }
  }

  pool = mysql.createPool(fullOptions);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS config_store (
      id TINYINT PRIMARY KEY,
      config_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id INT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      position VARCHAR(30),
      rating INT,
      base_price INT NOT NULL,
      photo LONGTEXT,
      status VARCHAR(20) NOT NULL,
      sold_to VARCHAR(120),
      sold_price INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id VARCHAR(20) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      color VARCHAR(20),
      logo LONGTEXT,
      budget INT NOT NULL,
      spent INT NOT NULL,
      players_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_state (
      id TINYINT PRIMARY KEY,
      phase VARCHAR(20) NOT NULL,
      current_player_json LONGTEXT,
      current_bid INT NOT NULL,
      leading_team_json LONGTEXT,
      bid_history_json LONGTEXT NOT NULL,
      sold_players_json LONGTEXT NOT NULL,
      timer_seconds INT NOT NULL DEFAULT 10,
      timer_ends_at BIGINT NULL,
      previous_bid_snapshot_json LONGTEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn('auction_state', 'timer_seconds', 'timer_seconds INT NOT NULL DEFAULT 10');
  await ensureColumn('auction_state', 'timer_ends_at', 'timer_ends_at BIGINT NULL');
}

function getPool() {
  if (!pool) {
    throw new Error('Database is not connected. Call connectDB() before model access.');
  }
  return pool;
}

async function loadConfig() {
  const [rows] = await getPool().query('SELECT config_json FROM config_store WHERE id = 1');
  if (!rows.length) return null;
  return parseJSON(rows[0].config_json, null);
}

async function saveConfig(config) {
  await getPool().query(
    `INSERT INTO config_store (id, config_json)
     VALUES (1, ?)
     ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)`,
    [JSON.stringify(config)],
  );
}

async function loadPlayers() {
  const [rows] = await getPool().query(
    `SELECT id, name, position, rating, base_price, photo, status, sold_to, sold_price
     FROM players
     ORDER BY id ASC`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    position: row.position,
    rating: Number(row.rating),
    basePrice: Number(row.base_price),
    photo: row.photo || '',
    status: row.status,
    soldTo: row.sold_to || undefined,
    soldPrice: row.sold_price === null ? undefined : Number(row.sold_price),
  }));
}

async function savePlayers(players) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM players');

    if (players.length) {
      const values = players.map((player) => [
        player.id,
        player.name,
        player.position,
        player.rating,
        player.basePrice,
        player.photo || '',
        player.status,
        player.soldTo || null,
        player.soldPrice ?? null,
      ]);

      await connection.query(
        `INSERT INTO players
         (id, name, position, rating, base_price, photo, status, sold_to, sold_price)
         VALUES ?`,
        [values],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function loadTeams() {
  const [rows] = await getPool().query(
    `SELECT id, name, color, logo, budget, spent, players_json
     FROM teams
     ORDER BY id ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    logo: row.logo || '',
    budget: Number(row.budget),
    spent: Number(row.spent),
    players: parseJSON(row.players_json, []),
  }));
}

async function saveTeams(teams) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM teams');

    if (teams.length) {
      const values = teams.map((team) => [
        team.id,
        team.name,
        team.color,
        team.logo || '',
        Number(team.budget),
        Number(team.spent || 0),
        JSON.stringify(team.players || []),
      ]);

      await connection.query(
        `INSERT INTO teams
         (id, name, color, logo, budget, spent, players_json)
         VALUES ?`,
        [values],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function loadAuctionState() {
  const [rows] = await getPool().query(
    `SELECT phase, current_player_json, current_bid, leading_team_json, bid_history_json, sold_players_json, timer_seconds, timer_ends_at, previous_bid_snapshot_json
     FROM auction_state
     WHERE id = 1`,
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    auctionState: {
      phase: row.phase,
      currentPlayer: parseJSON(row.current_player_json, null),
      currentBid: Number(row.current_bid || 0),
      leadingTeam: parseJSON(row.leading_team_json, null),
      bidHistory: parseJSON(row.bid_history_json, []),
      soldPlayers: parseJSON(row.sold_players_json, []),
      timerSeconds: Number(row.timer_seconds || 10),
      timerEndsAt: row.timer_ends_at === null ? null : Number(row.timer_ends_at),
    },
    previousBidSnapshot: parseJSON(row.previous_bid_snapshot_json, null),
  };
}

async function saveAuctionState({ auctionState, previousBidSnapshot }) {
  await getPool().query(
    `INSERT INTO auction_state
     (id, phase, current_player_json, current_bid, leading_team_json, bid_history_json, sold_players_json, timer_seconds, timer_ends_at, previous_bid_snapshot_json)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       phase = VALUES(phase),
       current_player_json = VALUES(current_player_json),
       current_bid = VALUES(current_bid),
       leading_team_json = VALUES(leading_team_json),
       bid_history_json = VALUES(bid_history_json),
       sold_players_json = VALUES(sold_players_json),
       timer_seconds = VALUES(timer_seconds),
       timer_ends_at = VALUES(timer_ends_at),
       previous_bid_snapshot_json = VALUES(previous_bid_snapshot_json)`,
    [
      auctionState.phase,
      JSON.stringify(auctionState.currentPlayer),
      auctionState.currentBid,
      JSON.stringify(auctionState.leadingTeam),
      JSON.stringify(auctionState.bidHistory || []),
      JSON.stringify(auctionState.soldPlayers || []),
      Number(auctionState.timerSeconds || 10),
      auctionState.timerEndsAt === null ? null : Number(auctionState.timerEndsAt),
      JSON.stringify(previousBidSnapshot),
    ],
  );
}

module.exports = {
  connectDB,
  loadConfig,
  saveConfig,
  loadPlayers,
  savePlayers,
  loadTeams,
  saveTeams,
  loadAuctionState,
  saveAuctionState,
};
