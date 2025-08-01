const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config();

// Import our custom store implementation
const Store = require('./store');

// Initialize store for saving connection settings
const store = new Store({
  defaults: {
    dbCredentials: {
      dbType: '',
      host: '',
      port: '',
      username: '',
      password: '',
      rememberCredentials: false
    },
    connectionProfiles: {}
  }
});

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development mode
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Database connection handlers
const dbConnections = {};

// Handle database connection request
ipcMain.handle('connect-database', async (event, connectionInfo) => {
  try {
    const { dbType, host, port, username, password, rememberCredentials } = connectionInfo;
    
    // Save credentials if requested
    if (rememberCredentials) {
      store.set('dbCredentials', connectionInfo);
    }
    
    // Connect to the appropriate database based on type
    let connection;
    
    switch (dbType) {
      case 'mysql':
        const mysql = require('mysql2/promise');
        connection = await mysql.createConnection({
          host,
          port: parseInt(port),
          user: username,
          password
        });
        break;
        
      case 'postgresql':
        const { Pool } = require('pg');
        connection = new Pool({
          host,
          port: parseInt(port),
          user: username,
          password
        });
        break;
        
      case 'sqlite':
        const sqlite3 = require('sqlite3');
        // Use sqlite3 directly instead of sqlite package
        connection = new sqlite3.Database(host); // For SQLite, host is the file path
        break;
        
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
    
    // Generate a unique connection ID
    const connectionId = Date.now().toString();
    dbConnections[connectionId] = { connection, dbType };
    
    return { success: true, connectionId };
  } catch (error) {
    console.error('Database connection error:', error);
    return { success: false, error: error.message };
  }
});

// Get saved credentials
ipcMain.handle('get-saved-credentials', () => {
  return store.get('dbCredentials');
});

// Save connection profile
ipcMain.handle('save-connection-profile', (event, profile) => {
  try {
    if (!profile.name) {
      return { success: false, error: 'Profile name is required' };
    }
    
    const profiles = store.get('connectionProfiles') || {};
    profiles[profile.name] = {
      dbType: profile.dbType,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      password: profile.password
    };
    
    store.set('connectionProfiles', profiles);
    return { success: true, profileName: profile.name };
  } catch (error) {
    console.error('Error saving connection profile:', error);
    return { success: false, error: error.message };
  }
});

// Load all connection profiles
ipcMain.handle('load-connection-profiles', () => {
  try {
    const profiles = store.get('connectionProfiles') || {};
    return { success: true, profiles: Object.keys(profiles) };
  } catch (error) {
    console.error('Error loading connection profiles:', error);
    return { success: false, error: error.message };
  }
});

// Load specific connection profile
ipcMain.handle('load-connection-profile', (event, profileName) => {
  try {
    const profiles = store.get('connectionProfiles') || {};
    const profile = profiles[profileName];
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    
    return { success: true, profile };
  } catch (error) {
    console.error('Error loading connection profile:', error);
    return { success: false, error: error.message };
  }
});

// List databases
ipcMain.handle('list-databases', async (event, connectionId) => {
  try {
    const { connection, dbType } = dbConnections[connectionId];
    
    if (!connection) {
      throw new Error('Database connection not found');
    }
    
    let databases = [];
    
    switch (dbType) {
      case 'mysql':
        const [rows] = await connection.query('SHOW DATABASES');
        databases = rows.map(row => row.Database);
        break;
        
      case 'postgresql':
        const result = await connection.query(
          "SELECT datname FROM pg_database WHERE datistemplate = false"
        );
        databases = result.rows.map(row => row.datname);
        break;
        
      case 'sqlite':
        // SQLite doesn't have multiple databases in the same connection
        databases = ['main'];
        break;
    }
    
    return { success: true, databases };
  } catch (error) {
    console.error('Error listing databases:', error);
    return { success: false, error: error.message };
  }
});

// Use specific database
ipcMain.handle('use-database', async (event, { connectionId, database }) => {
  try {
    const { connection, dbType } = dbConnections[connectionId];
    
    if (!connection) {
      throw new Error('Database connection not found');
    }
    
    switch (dbType) {
      case 'mysql':
        await connection.query(`USE \`${database}\``);
        break;
        
      case 'postgresql':
        // For PostgreSQL, we need to create a new connection with the database
        const { Pool } = require('pg');
        const config = connection.options;
        const newConnection = new Pool({
          ...config,
          database
        });
        
        // Close the old connection and update with the new one
        await connection.end();
        dbConnections[connectionId].connection = newConnection;
        break;
        
      case 'sqlite':
        // SQLite doesn't need to switch databases
        break;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error using database:', error);
    return { success: false, error: error.message };
  }
});

// List tables in a database
ipcMain.handle('list-tables', async (event, connectionId) => {
  try {
    const { connection, dbType } = dbConnections[connectionId];
    
    if (!connection) {
      throw new Error('Database connection not found');
    }
    
    let tables = [];
    
    switch (dbType) {
      case 'mysql':
        const [rows] = await connection.query('SHOW TABLES');
        tables = rows.map(row => Object.values(row)[0]);
        break;
        
      case 'postgresql':
        const result = await connection.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        );
        tables = result.rows.map(row => row.table_name);
        break;
        
      case 'sqlite':
        tables = await new Promise((resolve, reject) => {
          connection.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            (err, rows) => {
              if (err) {
                reject(err);
              } else {
                resolve(rows.map(row => row.name));
              }
            }
          );
        });
        break;
    }
    
    return { success: true, tables };
  } catch (error) {
    console.error('Error listing tables:', error);
    return { success: false, error: error.message };
  }
});

// Get table schema
ipcMain.handle('get-table-schema', async (event, { connectionId, table }) => {
  try {
    const { connection, dbType } = dbConnections[connectionId];
    
    if (!connection) {
      throw new Error('Database connection not found');
    }
    
    let columns = [];
    
    switch (dbType) {
      case 'mysql':
        const [rows] = await connection.query(`DESCRIBE \`${table}\``);
        columns = rows.map(row => ({
          name: row.Field,
          type: row.Type,
          nullable: row.Null === 'YES',
          key: row.Key,
          default: row.Default,
          extra: row.Extra
        }));
        break;
        
      case 'postgresql':
        const result = await connection.query(
          `SELECT column_name, data_type, is_nullable, column_default 
           FROM information_schema.columns 
           WHERE table_name = $1 
           ORDER BY ordinal_position`,
          [table]
        );
        columns = result.rows.map(row => ({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default
        }));
        break;
        
      case 'sqlite':
        columns = await new Promise((resolve, reject) => {
          connection.all(`PRAGMA table_info(${table})`, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows.map(row => ({
                name: row.name,
                type: row.type,
                nullable: row.notnull === 0,
                default: row.dflt_value,
                pk: row.pk === 1
              })));
            }
          });
        });
        break;
    }
    
    return { success: true, columns };
  } catch (error) {
    console.error('Error getting table schema:', error);
    return { success: false, error: error.message };
  }
});

// Execute SQL query
ipcMain.handle('execute-query', async (event, { connectionId, query }) => {
  try {
    const { connection, dbType } = dbConnections[connectionId];
    
    if (!connection) {
      throw new Error('Database connection not found');
    }
    
    let results;
    
    switch (dbType) {
      case 'mysql':
        const [rows] = await connection.query(query);
        results = rows;
        break;
        
      case 'postgresql':
        const result = await connection.query(query);
        results = result.rows;
        break;
        
      case 'sqlite':
        results = await new Promise((resolve, reject) => {
          connection.all(query, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          });
        });
        break;
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Error executing query:', error);
    return { success: false, error: error.message };
  }
});

// Export query results to CSV
ipcMain.handle('export-to-csv', async (event, { data, filename }) => {
  try {
    // Show save dialog
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export to CSV',
      defaultPath: filename || 'query_results.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    
    if (!filePath) {
      return { success: false, error: 'Export cancelled' };
    }
    
    // Convert data to CSV
    if (data.length === 0) {
      return { success: false, error: 'No data to export' };
    }
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => {
      return Object.values(row).map(value => {
        // Handle values with commas, quotes, or newlines
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;  // Escape quotes
        }
        return stringValue;
      }).join(',');
    }).join('\n');
    
    const csvContent = `${headers}\n${rows}`;
    
    // Write to file
    fs.writeFileSync(filePath, csvContent, 'utf8');
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return { success: false, error: error.message };
  }
});

// Export query results to Excel
ipcMain.handle('export-to-excel', async (event, { data, filename }) => {
  try {
    // Show save dialog
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export to Excel',
      defaultPath: filename || 'query_results.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    
    if (!filePath) {
      return { success: false, error: 'Export cancelled' };
    }
    
    // Convert data to Excel
    if (data.length === 0) {
      return { success: false, error: 'No data to export' };
    }
    
    // Use ExcelJS for Excel export
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Query Results');
    
    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    
    // Add data rows
    data.forEach(row => {
      const rowValues = headers.map(header => {
        const value = row[header];
        return value === null || value === undefined ? '' : value;
      });
      worksheet.addRow(rowValues);
    });
    
    // Format headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        bottom: { style: 'thin' }
      };
    });
    
    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50); // Cap width at 50 characters
    });
    
    // Write to file
    await workbook.xlsx.writeFile(filePath);
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { success: false, error: error.message };
  }
});

// Export query results to JSON
ipcMain.handle('export-to-json', async (event, { data, filename }) => {
  try {
    // Show save dialog
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export to JSON',
      defaultPath: filename || 'query_results.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    
    if (!filePath) {
      return { success: false, error: 'Export cancelled' };
    }
    
    // Convert data to JSON
    if (data.length === 0) {
      return { success: false, error: 'No data to export' };
    }
    
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    return { success: false, error: error.message };
  }
});

// Natural language to SQL conversion
ipcMain.handle('nl-to-sql', async (event, { prompt, dbType, schema, connectionId }) => {
  try {
    const OpenAI = require('openai');
    
    // Initialize OpenAI client with API key from environment variable
    // IMPORTANT: In production, this should be securely stored and not hardcoded
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return { 
        success: false, 
        error: 'OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.'
      };
    }
    
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Prepare the system message with database-specific information
    let systemMessage = `You are an expert SQL assistant that converts natural language queries into valid SQL for ${dbType} databases. `;
    systemMessage += `Generate syntactically correct, optimized SQL queries based on the following schema information:\n\n${schema}`;
    systemMessage += `\n\nRespond ONLY with the SQL query, no explanations or markdown formatting.`;
    
    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for best SQL generation
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more deterministic outputs
      max_tokens: 1000
    });
    
    // Extract the SQL query from the response
    const sqlQuery = response.choices[0].message.content.trim();
    
    // Validate the SQL query (basic validation)
    if (!sqlQuery || !sqlQuery.toLowerCase().includes('select') && 
        !sqlQuery.toLowerCase().includes('insert') && 
        !sqlQuery.toLowerCase().includes('update') && 
        !sqlQuery.toLowerCase().includes('delete') && 
        !sqlQuery.toLowerCase().includes('create') && 
        !sqlQuery.toLowerCase().includes('alter')) {
      return { 
        success: false, 
        error: 'Generated SQL query appears to be invalid.'
      };
    }
    
    return { 
      success: true, 
      sqlQuery: sqlQuery
    };
  } catch (error) {
    console.error('Error in natural language to SQL conversion:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred during natural language to SQL conversion'
    };
  }
});

// Get database schema for AI assistant
ipcMain.handle('get-database-schema', async (event, { connectionId }) => {
  try {
    const { connection, dbType } = dbConnections[connectionId];
    
    if (!connection) {
      throw new Error('Database connection not found');
    }
    
    let schemaInfo = '';
    
    switch (dbType) {
      case 'mysql':
        // Get current database name
        const [dbRows] = await connection.query('SELECT DATABASE() as db');
        const dbName = dbRows[0].db;
        
        if (!dbName) {
          throw new Error('No database selected');
        }
        
        // Get table list
        const [tables] = await connection.query('SHOW TABLES');
        const tableList = tables.map(row => Object.values(row)[0]);
        
        // Get schema for each table
        for (const table of tableList) {
          // Get columns
          const [columns] = await connection.query(`DESCRIBE \`${table}\``);
          
          schemaInfo += `Table: ${table}\n`;
          schemaInfo += 'Columns:\n';
          
          columns.forEach(col => {
            schemaInfo += `  - ${col.Field} (${col.Type})`;
            if (col.Key === 'PRI') schemaInfo += ' PRIMARY KEY';
            if (col.Key === 'UNI') schemaInfo += ' UNIQUE';
            if (col.Key === 'MUL') schemaInfo += ' INDEX';
            if (col.Extra === 'auto_increment') schemaInfo += ' AUTO_INCREMENT';
            if (col.Null === 'NO') schemaInfo += ' NOT NULL';
            if (col.Default !== null) schemaInfo += ` DEFAULT ${col.Default}`;
            schemaInfo += '\n';
          });
          
          schemaInfo += '\n';
        }
        break;
        
      case 'postgresql':
        // Get current database name
        const dbResult = await connection.query('SELECT current_database() as db');
        const pgDbName = dbResult.rows[0].db;
        
        // Get schema for tables in the current database
        const tableQuery = `
          SELECT 
            table_name 
          FROM 
            information_schema.tables 
          WHERE 
            table_schema = 'public' AND 
            table_type = 'BASE TABLE'
        `;
        
        const tableResult = await connection.query(tableQuery);
        const pgTables = tableResult.rows.map(row => row.table_name);
        
        for (const table of pgTables) {
          // Get columns
          const columnQuery = `
            SELECT 
              column_name, 
              data_type, 
              is_nullable, 
              column_default,
              character_maximum_length
            FROM 
              information_schema.columns 
            WHERE 
              table_schema = 'public' AND 
              table_name = $1
            ORDER BY 
              ordinal_position
          `;
          
          const columnResult = await connection.query(columnQuery, [table]);
          
          // Get primary key info
          const pkQuery = `
            SELECT 
              kcu.column_name 
            FROM 
              information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE 
              tc.constraint_type = 'PRIMARY KEY' AND
              tc.table_schema = 'public' AND
              tc.table_name = $1
          `;
          
          const pkResult = await connection.query(pkQuery, [table]);
          const primaryKeys = pkResult.rows.map(row => row.column_name);
          
          schemaInfo += `Table: ${table}\n`;
          schemaInfo += 'Columns:\n';
          
          columnResult.rows.forEach(col => {
            let dataType = col.data_type;
            if (col.character_maximum_length) {
              dataType += `(${col.character_maximum_length})`;
            }
            
            schemaInfo += `  - ${col.column_name} (${dataType})`;
            if (primaryKeys.includes(col.column_name)) schemaInfo += ' PRIMARY KEY';
            if (col.is_nullable === 'NO') schemaInfo += ' NOT NULL';
            if (col.column_default !== null) schemaInfo += ` DEFAULT ${col.column_default}`;
            schemaInfo += '\n';
          });
          
          schemaInfo += '\n';
        }
        break;
        
      case 'sqlite':
        // Get list of tables
        const sqliteTables = await new Promise((resolve, reject) => {
          connection.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(row => row.name));
          });
        });
        
        for (const table of sqliteTables) {
          // Get table info
          const tableInfo = await new Promise((resolve, reject) => {
            connection.all(`PRAGMA table_info(${table})`, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          
          schemaInfo += `Table: ${table}\n`;
          schemaInfo += 'Columns:\n';
          
          tableInfo.forEach(col => {
            schemaInfo += `  - ${col.name} (${col.type})`;
            if (col.pk === 1) schemaInfo += ' PRIMARY KEY';
            if (col.notnull === 1) schemaInfo += ' NOT NULL';
            if (col.dflt_value !== null) schemaInfo += ` DEFAULT ${col.dflt_value}`;
            schemaInfo += '\n';
          });
          
          schemaInfo += '\n';
        }
        break;
        
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
    
    return { 
      success: true, 
      schema: schemaInfo,
      dbType: dbType
    };
  } catch (error) {
    console.error('Error getting database schema:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred while retrieving the database schema'
    };
  }
});

// Close database connection
ipcMain.handle('close-connection', async (event, connectionId) => {
  try {
    const { connection, dbType } = dbConnections[connectionId];
    
    if (!connection) {
      return { success: true }; // Already closed or not found
    }
    
    switch (dbType) {
      case 'mysql':
      case 'postgresql':
        await connection.end();
        break;
        
      case 'sqlite':
        await new Promise((resolve, reject) => {
          connection.close(err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        break;
    }
    
    delete dbConnections[connectionId];
    return { success: true };
  } catch (error) {
    console.error('Error closing connection:', error);
    return { success: false, error: error.message };
  }
});