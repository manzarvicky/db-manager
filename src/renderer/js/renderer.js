// Global variables
let currentScreen = 'welcome-screen';
let currentConnectionId = null;
let currentDatabase = null;
let currentTable = null;
let darkMode = false;
let databaseSchema = null;
let databaseType = null;
let isGeneratingSql = false;

// DOM Elements
const screens = {
  welcome: document.getElementById('welcome-screen'),
  connection: document.getElementById('connection-screen'),
  browser: document.getElementById('browser-screen'),
  query: document.getElementById('query-screen')
};

// Check for saved dark mode preference
function initTheme() {
  const savedDarkMode = localStorage.getItem('darkMode');
  if (savedDarkMode === 'true') {
    enableDarkMode();
  }
}

// Dark mode toggle
function enableDarkMode() {
  document.body.classList.add('dark-mode');
  document.getElementById('mode-toggle').innerHTML = '<i class="fas fa-sun"></i>';
  darkMode = true;
  localStorage.setItem('darkMode', 'true');
}

function disableDarkMode() {
  document.body.classList.remove('dark-mode');
  document.getElementById('mode-toggle').innerHTML = '<i class="fas fa-moon"></i>';
  darkMode = false;
  localStorage.setItem('darkMode', 'false');
}

document.getElementById('mode-toggle').addEventListener('click', () => {
  if (darkMode) {
    disableDarkMode();
  } else {
    enableDarkMode();
  }
});

// Navigation functions
function showScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  
  // Show the requested screen
  document.getElementById(screenId).classList.add('active');
  currentScreen = screenId;
}

// Welcome Screen
document.getElementById('connect-btn').addEventListener('click', () => {
  showScreen('connection-screen');
  loadSavedCredentials();
});

// Back button from connection to welcome
document.getElementById('back-to-welcome-btn').addEventListener('click', () => {
  showScreen('welcome-screen');
});

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAiAssistant();
  initTableDetails();
});

// Initialize table details display
function initTableDetails() {
  // Set initial display state for browser AI assistant content
  const browserAiContent = document.querySelector('.browser-ai-assistant-content');
  if (browserAiContent) {
    browserAiContent.style.display = 'block';
  }
  
  // Set initial display state for table schema
  const tableSchema = document.getElementById('table-schema');
  if (tableSchema) {
    tableSchema.style.display = 'block';
  }
}

// Initialize AI SQL Assistant
function initAiAssistant() {
  // Query screen AI assistant
  document.getElementById('generate-sql-btn').addEventListener('click', generateSql);
  document.getElementById('clear-nl-query-btn').addEventListener('click', () => {
    document.getElementById('nl-query-input').value = '';
    document.getElementById('ai-error').textContent = '';
    document.getElementById('ai-result').classList.add('hidden');
  });
  document.getElementById('toggle-ai-assistant-btn').addEventListener('click', toggleAiAssistant);
  document.getElementById('copy-sql-btn').addEventListener('click', () => {
    const sqlText = document.getElementById('ai-sql-display').textContent;
    navigator.clipboard.writeText(sqlText)
      .then(() => {
        const copyBtn = document.getElementById('copy-sql-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  });
  
  // Browser screen AI assistant
  document.getElementById('browser-generate-sql-btn').addEventListener('click', browserGenerateSql);
  document.getElementById('browser-clear-nl-query-btn').addEventListener('click', () => {
    document.getElementById('browser-nl-query-input').value = '';
    document.getElementById('browser-ai-error').textContent = '';
    document.getElementById('browser-ai-result').classList.add('hidden');
  });
  document.getElementById('browser-toggle-ai-assistant-btn').addEventListener('click', toggleBrowserAiAssistant);
  document.getElementById('browser-copy-sql-btn').addEventListener('click', () => {
    const sqlText = document.getElementById('browser-ai-sql-display').textContent;
    navigator.clipboard.writeText(sqlText)
      .then(() => {
        const copyBtn = document.getElementById('browser-copy-sql-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  });
  
  // Table details toggle
  document.getElementById('toggle-table-details-btn').addEventListener('click', toggleTableDetails);
}

// Toggle AI Assistant panel visibility in query screen
function toggleAiAssistant() {
  const content = document.querySelector('.ai-assistant-content');
  const button = document.getElementById('toggle-ai-assistant-btn');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    button.innerHTML = '<i class="fas fa-chevron-up"></i>';
  } else {
    content.style.display = 'none';
    button.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
}

// Toggle AI Assistant panel visibility in browser screen
function toggleBrowserAiAssistant() {
  const content = document.querySelector('.browser-ai-assistant-content');
  const button = document.getElementById('browser-toggle-ai-assistant-btn');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    button.innerHTML = '<i class="fas fa-chevron-up"></i>';
  } else {
    content.style.display = 'none';
    button.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
}

// Toggle Table Details visibility
function toggleTableDetails() {
  const content = document.getElementById('table-schema');
  const button = document.getElementById('toggle-table-details-btn');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    button.innerHTML = '<i class="fas fa-chevron-up"></i>';
  } else {
    content.style.display = 'none';
    button.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
}

// Fetch database schema for AI assistant
async function fetchDatabaseSchema() {
  try {
    if (!currentConnectionId) {
      throw new Error('No active database connection');
    }
    
    // Show loading indicator
    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach(indicator => indicator.classList.remove('hidden'));
    
    // Clear previous errors
    document.getElementById('ai-error').textContent = '';
    document.getElementById('browser-ai-error').textContent = '';
    
    // Fetch schema from the main process
    const result = await window.api.getDatabaseSchema({ connectionId: currentConnectionId });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch database schema');
    }
    
    // Store schema and database type for later use
    databaseSchema = result.schema;
    databaseType = result.dbType;
    
    return true;
  } catch (error) {
    console.error('Error fetching database schema:', error);
    document.getElementById('ai-error').textContent = error.message;
    document.getElementById('browser-ai-error').textContent = error.message;
    return false;
  } finally {
    // Hide loading indicators
    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach(indicator => indicator.classList.add('hidden'));
  }
}

// Generate SQL from natural language in query screen
async function generateSql() {
  try {
    if (isGeneratingSql) return; // Prevent multiple simultaneous requests
    isGeneratingSql = true;
    
    const nlQuery = document.getElementById('nl-query-input').value.trim();
    const queryInput = document.getElementById('query-input');
    const aiError = document.getElementById('ai-error');
    
    // Clear previous errors
    aiError.textContent = '';
    
    if (!nlQuery) {
      throw new Error('Please enter a query in natural language');
    }
    
    if (!currentConnectionId) {
      throw new Error('No active database connection');
    }
    
    // Show loading indicator
    const loadingIndicator = document.querySelector('.ai-status .loading-indicator');
    loadingIndicator.classList.remove('hidden');
    
    // Fetch schema if not already available
    if (!databaseSchema) {
      const schemaFetched = await fetchDatabaseSchema();
      if (!schemaFetched) {
        throw new Error('Failed to fetch database schema');
      }
    }
    
    // Call the natural language to SQL conversion
    const result = await window.api.naturalLanguageToSql({
      prompt: nlQuery,
      dbType: databaseType,
      schema: databaseSchema,
      connectionId: currentConnectionId
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate SQL query');
    }
    
    // Update the SQL query input with the generated query
    queryInput.value = result.sqlQuery;
    
    // Also display the SQL in the result display
    const sqlDisplay = document.getElementById('ai-sql-display');
    sqlDisplay.textContent = result.sqlQuery;
    document.getElementById('ai-result').classList.remove('hidden');
    
    // Scroll to the result display to show the result
    document.getElementById('ai-result').scrollIntoView({ behavior: 'smooth' });
    
    // Flash the query input to highlight the change
    queryInput.classList.add('highlight');
    setTimeout(() => {
      queryInput.classList.remove('highlight');
    }, 1000);
    
  } catch (error) {
    console.error('Error generating SQL:', error);
    document.getElementById('ai-error').textContent = error.message;
    document.getElementById('ai-result').classList.add('hidden');
  } finally {
    // Hide loading indicator
    const loadingIndicator = document.querySelector('.ai-status .loading-indicator');
    loadingIndicator.classList.add('hidden');
    isGeneratingSql = false;
  }
}

// Generate SQL from natural language in browser screen
async function browserGenerateSql() {
  try {
    if (isGeneratingSql) return; // Prevent multiple simultaneous requests
    isGeneratingSql = true;
    
    const nlQuery = document.getElementById('browser-nl-query-input').value.trim();
    const queryInput = document.getElementById('browser-query-input');
    const aiError = document.getElementById('browser-ai-error');
    
    // Clear previous errors
    aiError.textContent = '';
    
    if (!nlQuery) {
      throw new Error('Please enter a query in natural language');
    }
    
    if (!currentConnectionId) {
      throw new Error('No active database connection');
    }
    
    // Show loading indicator
    const loadingIndicator = document.querySelector('#browser-ai-status .loading-indicator');
    loadingIndicator.classList.remove('hidden');
    
    // Fetch schema if not already available
    if (!databaseSchema) {
      const schemaFetched = await fetchDatabaseSchema();
      if (!schemaFetched) {
        throw new Error('Failed to fetch database schema');
      }
    }
    
    // Call the natural language to SQL conversion
    const result = await window.api.naturalLanguageToSql({
      prompt: nlQuery,
      dbType: databaseType,
      schema: databaseSchema,
      connectionId: currentConnectionId
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate SQL query');
    }
    
    // Update the SQL query input with the generated query
    queryInput.value = result.sqlQuery;
    
    // Also display the SQL in the result display
    const sqlDisplay = document.getElementById('browser-ai-sql-display');
    sqlDisplay.textContent = result.sqlQuery;
    document.getElementById('browser-ai-result').classList.remove('hidden');
    
    // Scroll to the result display to show the result
    document.getElementById('browser-ai-result').scrollIntoView({ behavior: 'smooth' });
    
    // Flash the query input to highlight the change
    queryInput.classList.add('highlight');
    setTimeout(() => {
      queryInput.classList.remove('highlight');
    }, 1000);
    
  } catch (error) {
    console.error('Error generating SQL:', error);
    document.getElementById('browser-ai-error').textContent = error.message;
    document.getElementById('browser-ai-result').classList.add('hidden');
  } finally {
    // Hide loading indicator
    const loadingIndicator = document.querySelector('#browser-ai-status .loading-indicator');
    loadingIndicator.classList.add('hidden');
    isGeneratingSql = false;
  }
}

// Load saved credentials if available
async function loadSavedCredentials() {
  try {
    const savedCredentials = await window.api.getSavedCredentials();
    
    if (savedCredentials) {
      document.getElementById('db-type').value = savedCredentials.dbType;
      document.getElementById('host').value = savedCredentials.host;
      document.getElementById('port').value = savedCredentials.port;
      document.getElementById('username').value = savedCredentials.username;
      document.getElementById('password').value = savedCredentials.password;
      document.getElementById('remember-credentials').checked = true;
      
      // Update UI based on database type
      updateConnectionForm();
    }
  } catch (error) {
    console.error('Error loading saved credentials:', error);
  }
}

// Connection Screen
document.getElementById('db-type').addEventListener('change', updateConnectionForm);

function updateConnectionForm() {
  const dbType = document.getElementById('db-type').value;
  const portGroup = document.getElementById('port-group');
  const usernameGroup = document.getElementById('username-group');
  const passwordGroup = document.getElementById('password-group');
  const hostHelp = document.getElementById('host-help');
  
  if (dbType === 'sqlite') {
    portGroup.style.display = 'none';
    usernameGroup.style.display = 'none';
    passwordGroup.style.display = 'none';
    hostHelp.textContent = 'Enter the file path to your SQLite database';
  } else {
    portGroup.style.display = 'block';
    usernameGroup.style.display = 'block';
    passwordGroup.style.display = 'block';
    hostHelp.textContent = dbType === 'mysql' ? 'Default: localhost' : 'Default: localhost';
    
    // Set default port based on database type
    const portInput = document.getElementById('port');
    if (!portInput.value) {
      portInput.value = dbType === 'mysql' ? '3306' : '5432';
    }
  }
}

// Load connection profiles when connection screen is shown
async function loadConnectionProfiles() {
  try {
    const result = await window.api.loadConnectionProfiles();
    
    if (!result.success) {
      console.error('Error loading profiles:', result.error);
      return;
    }
    
    const profileList = document.getElementById('profile-list');
    
    // Clear existing options except the first one
    while (profileList.options.length > 1) {
      profileList.remove(1);
    }
    
    // Add profiles to the dropdown
    result.profiles.forEach(profileName => {
      const option = document.createElement('option');
      option.value = profileName;
      option.textContent = profileName;
      profileList.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading connection profiles:', error);
  }
}

// Save connection profile
document.getElementById('save-profile-btn').addEventListener('click', async () => {
  const profileName = document.getElementById('profile-name').value.trim();
  
  if (!profileName) {
    alert('Please enter a profile name');
    return;
  }
  
  const dbType = document.getElementById('db-type').value;
  const host = document.getElementById('host').value;
  const port = document.getElementById('port').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  try {
    const result = await window.api.saveConnectionProfile({
      name: profileName,
      dbType,
      host,
      port,
      username,
      password
    });
    
    if (result.success) {
      alert(`Profile "${profileName}" saved successfully`);
      await loadConnectionProfiles();
    } else {
      alert(`Error saving profile: ${result.error}`);
    }
  } catch (error) {
    console.error('Error saving connection profile:', error);
    alert(`Error saving profile: ${error.message}`);
  }
});

// Load connection profile
document.getElementById('load-profile-btn').addEventListener('click', async () => {
  const profileName = document.getElementById('profile-list').value;
  
  if (!profileName) {
    alert('Please select a profile');
    return;
  }
  
  try {
    const result = await window.api.loadConnectionProfile(profileName);
    
    if (result.success) {
      const { profile } = result;
      
      // Fill form with profile data
      document.getElementById('db-type').value = profile.dbType;
      document.getElementById('host').value = profile.host;
      document.getElementById('port').value = profile.port;
      document.getElementById('username').value = profile.username;
      document.getElementById('password').value = profile.password;
      document.getElementById('profile-name').value = profileName;
      
      // Update form based on database type
      updateConnectionForm();
    } else {
      alert(`Error loading profile: ${result.error}`);
    }
  } catch (error) {
    console.error('Error loading connection profile:', error);
    alert(`Error loading profile: ${error.message}`);
  }
});

// Load profiles when connection screen is shown
document.getElementById('connect-btn').addEventListener('click', () => {
  loadConnectionProfiles();
});

// Back button from browser to connection
document.getElementById('back-to-connection-btn').addEventListener('click', async () => {
  if (confirm('Are you sure you want to go back? This will disconnect from the current database.')) {
    try {
      await window.api.closeConnection(currentConnectionId);
      currentConnectionId = null;
      currentDatabase = null;
      currentTable = null;
      showScreen('connection-screen');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }
});

// Disconnect button
document.getElementById('disconnect-btn').addEventListener('click', async () => {
  if (confirm('Are you sure you want to disconnect?')) {
    try {
      await window.api.closeConnection(currentConnectionId);
      currentConnectionId = null;
      currentDatabase = null;
      currentTable = null;
      showScreen('connection-screen');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }
});

// Clear query button
document.getElementById('clear-query-btn').addEventListener('click', () => {
  document.getElementById('browser-query-input').value = '';
});

// Refresh table button
document.getElementById('refresh-table-btn').addEventListener('click', () => {
  if (currentTable) {
    loadTableSchema(currentDatabase, currentTable);
  }
});

// Handle connection form submission
document.getElementById('connection-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const connectionError = document.getElementById('connection-error');
  connectionError.style.display = 'none';
  
  try {
    const dbType = document.getElementById('db-type').value;
    const host = document.getElementById('host').value;
    const port = document.getElementById('port').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberCredentials = document.getElementById('remember-credentials').checked;
    
    // Validate input
    if (!host) {
      throw new Error('Host is required');
    }
    
    if (dbType !== 'sqlite' && !port) {
      throw new Error('Port is required');
    }
    
    // Connect to database
    const result = await window.api.connectDatabase({
      dbType,
      host,
      port,
      username,
      password,
      rememberCredentials
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to connect to database');
    }
    
    // Save connection ID
    currentConnectionId = result.connectionId;
    
    // Load databases
    await loadDatabases();
    
    // Navigate to browser screen
    showScreen('browser-screen');
  } catch (error) {
    connectionError.textContent = error.message;
    connectionError.style.display = 'block';
  }
});

// Browser Screen
// Database search functionality
document.getElementById('database-search').addEventListener('input', function() {
  const searchTerm = this.value.toLowerCase();
  const databaseItems = document.querySelectorAll('.database-item');
  
  databaseItems.forEach(item => {
    const databaseName = item.querySelector('.database-name').textContent.toLowerCase();
    if (databaseName.includes(searchTerm)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
});

async function loadDatabases() {
  try {
    const databaseContainer = document.getElementById('database-container');
    databaseContainer.innerHTML = '<div class="loading">Loading databases...</div>';
    
    const result = await window.api.listDatabases(currentConnectionId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load databases');
    }
    
    // Display databases
    databaseContainer.innerHTML = '';
    
    if (result.databases.length === 0) {
      databaseContainer.innerHTML = '<div class="error">No databases found</div>';
      return;
    }
    
    result.databases.forEach(database => {
      // Create database item container
      const databaseItem = document.createElement('div');
      databaseItem.className = 'database-item';
      databaseItem.dataset.database = database;
      
      // Create database header
      const databaseHeader = document.createElement('div');
      databaseHeader.className = 'database-header';
      databaseHeader.addEventListener('click', () => toggleDatabase(database, databaseItem));
      
      // Create database name
      const databaseName = document.createElement('div');
      databaseName.className = 'database-name';
      databaseName.textContent = database;
      
      // Create toggle icon
      const databaseToggle = document.createElement('div');
      databaseToggle.className = 'database-toggle';
      databaseToggle.innerHTML = '▶';
      
      // Create table container (initially hidden)
      const tableContainer = document.createElement('div');
      tableContainer.className = 'table-container';
      tableContainer.dataset.database = database;
      
      // Assemble the components
      databaseHeader.appendChild(databaseName);
      databaseHeader.appendChild(databaseToggle);
      databaseItem.appendChild(databaseHeader);
      databaseItem.appendChild(tableContainer);
      
      databaseContainer.appendChild(databaseItem);
    });
  } catch (error) {
    console.error('Error loading databases:', error);
    const databaseContainer = document.getElementById('database-container');
    databaseContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function toggleDatabase(database, databaseItem) {
  try {
    // Get elements
    const databaseHeader = databaseItem.querySelector('.database-header');
    const databaseToggle = databaseItem.querySelector('.database-toggle');
    const tableContainer = databaseItem.querySelector('.table-container');
    
    // Check if this database is already selected
    const isSelected = databaseHeader.classList.contains('active');
    
    // Update UI for all databases (deselect others)
    document.querySelectorAll('.database-header').forEach(header => {
      header.classList.remove('active');
    });
    
    // Select this database
    databaseHeader.classList.add('active');
    
    // Save current database
    currentDatabase = database;
    
    // Use the selected database
    const result = await window.api.useDatabase({
      connectionId: currentConnectionId,
      database
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to select database');
    }
    
    // Toggle tables visibility
    const isOpen = tableContainer.classList.contains('open');
    
    if (!isOpen) {
      // Close all other table containers
      document.querySelectorAll('.table-container').forEach(container => {
        container.classList.remove('open');
      });
      document.querySelectorAll('.database-toggle').forEach(toggle => {
        toggle.classList.remove('open');
      });
      
      // Open this table container
      tableContainer.classList.add('open');
      databaseToggle.classList.add('open');
      
      // Load tables if not already loaded
      if (tableContainer.children.length === 0) {
        await loadTablesForDatabase(database, tableContainer);
      }
    } else if (isSelected) {
      // If already open and selected, close it
      tableContainer.classList.remove('open');
      databaseToggle.classList.remove('open');
    } else {
      // If already open but not selected, keep it open
      // This happens when clicking a different database that's already open
    }
  } catch (error) {
    console.error('Error toggling database:', error);
  }
}

async function loadTablesForDatabase(database, tableContainer) {
  try {
    tableContainer.innerHTML = '<div class="loading">Loading tables...</div>';
    
    const result = await window.api.listTables(currentConnectionId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load tables');
    }
    
    // Display tables
    tableContainer.innerHTML = '';
    
    if (result.tables.length === 0) {
      tableContainer.innerHTML = '<div class="empty-message"><i class="fas fa-table"></i><p>No tables found</p></div>';
      return;
    }
    
    result.tables.forEach(table => {
      const tableItem = document.createElement('div');
      tableItem.className = 'table-item';
      
      const tableIcon = document.createElement('i');
      tableIcon.className = 'fas fa-table';
      
      const tableName = document.createElement('span');
      tableName.textContent = table;
      
      tableItem.appendChild(tableIcon);
      tableItem.appendChild(tableName);
      
      tableItem.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent triggering database toggle
        selectTable(table, tableItem);
      });
      
      tableContainer.appendChild(tableItem);
    });
  } catch (error) {
    console.error('Error loading tables:', error);
    tableContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function selectTable(table, tableItem) {
  try {
    // Update UI
    document.querySelectorAll('.table-item').forEach(item => {
      item.classList.remove('active');
    });
    
    tableItem.classList.add('active');
    
    // Save current table
    currentTable = table;
    
    // Update table info
    document.getElementById('selected-table').textContent = table;
    
    // Show loading indicator
    const schemaBody = document.getElementById('schema-body');
    schemaBody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fas fa-spinner fa-spin"></i> Loading schema...</td></tr>';
    
    // Load table schema
    const result = await window.api.getTableSchema({
      connectionId: currentConnectionId,
      table
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load table schema');
    }
    
    // Store schema for SQL query generation
    currentTableSchema = result.columns;
    
    // Display schema
    schemaBody.innerHTML = '';
    
    result.columns.forEach(column => {
      const tr = document.createElement('tr');
      
      // Column name
      const tdName = document.createElement('td');
      if (column.key === 'PRI' || column.pk) {
        tdName.innerHTML = `<i class="fas fa-key"></i> ${column.name}`;
        tdName.classList.add('primary-key');
      } else {
        tdName.textContent = column.name;
      }
      tr.appendChild(tdName);
      
      // Column type
      const tdType = document.createElement('td');
      tdType.textContent = column.type;
      tr.appendChild(tdType);
      
      // Nullable
      const tdNullable = document.createElement('td');
      tdNullable.innerHTML = column.nullable ? 
        '<i class="fas fa-check text-success"></i> YES' : 
        '<i class="fas fa-times text-danger"></i> NO';
      tr.appendChild(tdNullable);
      
      // Default value
      const tdDefault = document.createElement('td');
      tdDefault.textContent = column.default !== null ? column.default : '';
      tr.appendChild(tdDefault);
      
      // Extra info
      const tdExtra = document.createElement('td');
      if (column.key === 'PRI' || column.pk) {
        tdExtra.innerHTML = '<span class="badge primary-key">Primary Key</span>';
      } else if (column.key === 'UNI') {
        tdExtra.innerHTML = '<span class="badge unique-key">Unique</span>';
      } else if (column.key === 'MUL') {
        tdExtra.innerHTML = '<span class="badge foreign-key">Foreign Key</span>';
      } else if (column.extra) {
        tdExtra.textContent = column.extra;
        if (column.extra.includes('auto_increment')) {
          tdExtra.innerHTML = '<span class="badge auto-increment">Auto Increment</span>';
        }
      }
      tr.appendChild(tdExtra);
      
      schemaBody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error selecting table:', error);
    document.getElementById('schema-body').innerHTML = 
      `<tr><td colspan="5" class="error"><i class="fas fa-exclamation-triangle"></i> Error: ${error.message}</td></tr>`;
    // Reset schema if there's an error
    currentTableSchema = [];
  }
}

// Store table schema for query generation
let currentTableSchema = [];

// Update the schema when a table is selected
async function updateTableSchema() {
  if (!currentTable || !currentConnectionId) return;
  
  try {
    const result = await window.api.getTableSchema({
      connectionId: currentConnectionId,
      table: currentTable
    });
    
    if (result.success) {
      currentTableSchema = result.columns;
    }
  } catch (error) {
    console.error('Error fetching table schema for query generation:', error);
  }
}

// Helper function to generate column list from schema
function getColumnList() {
  if (!currentTableSchema || currentTableSchema.length === 0) {
    return 'column1, column2';
  }
  
  return currentTableSchema.map(col => col.name).join(', ');
}

// Helper function to generate value placeholders
function getValuePlaceholders() {
  if (!currentTableSchema || currentTableSchema.length === 0) {
    return 'value1, value2';
  }
  
  return currentTableSchema.map(col => {
    if (col.type.includes('varchar') || col.type.includes('text') || col.type.includes('char')) {
      return '\'value\'';
    } else if (col.type.includes('int') || col.type.includes('float') || col.type.includes('double') || col.type.includes('decimal')) {
      return '0';
    } else if (col.type.includes('date') || col.type.includes('time')) {
      return 'NOW()';
    } else {
      return 'NULL';
    }
  }).join(', ');
}

// Helper function to find primary key column
function getPrimaryKeyCondition() {
  if (!currentTableSchema || currentTableSchema.length === 0) {
    return 'condition';
  }
  
  const pkColumn = currentTableSchema.find(col => col.key === 'PRI' || col.pk);
  if (pkColumn) {
    return `${pkColumn.name} = value`;
  } else {
    return 'condition';
  }
}

// SQL Shortcut Buttons
document.getElementById('sql-select-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    document.getElementById('browser-query-input').value = `SELECT * FROM ${currentTable} LIMIT 100;`;
  } else {
    document.getElementById('browser-query-input').value = 'SELECT * FROM table_name LIMIT 100;';
  }
});

document.getElementById('sql-insert-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    const columns = getColumnList();
    const values = getValuePlaceholders();
    document.getElementById('browser-query-input').value = `INSERT INTO ${currentTable} (${columns}) VALUES (${values});`;
  } else {
    document.getElementById('browser-query-input').value = 'INSERT INTO table_name (column1, column2) VALUES (value1, value2);';
  }
});

document.getElementById('sql-update-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    const condition = getPrimaryKeyCondition();
    document.getElementById('browser-query-input').value = `UPDATE ${currentTable} SET column_name = new_value WHERE ${condition};`;
  } else {
    document.getElementById('browser-query-input').value = 'UPDATE table_name SET column1 = value1 WHERE condition;';
  }
});

document.getElementById('sql-delete-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    const condition = getPrimaryKeyCondition();
    document.getElementById('browser-query-input').value = `DELETE FROM ${currentTable} WHERE ${condition};`;
  } else {
    document.getElementById('browser-query-input').value = 'DELETE FROM table_name WHERE condition;';
  }
});

document.getElementById('sql-alter-btn').addEventListener('click', () => {
  if (currentTable) {
    document.getElementById('browser-query-input').value = `ALTER TABLE ${currentTable} ADD COLUMN new_column_name VARCHAR(255);`;
  } else {
    document.getElementById('browser-query-input').value = 'ALTER TABLE table_name ADD COLUMN new_column_name VARCHAR(255);';
  }
});

document.getElementById('sql-create-btn').addEventListener('click', () => {
  const newTableName = currentTable ? `${currentTable}_new` : 'new_table_name';
  document.getElementById('browser-query-input').value = `CREATE TABLE ${newTableName} (
  id INT PRIMARY KEY AUTO_INCREMENT,
  column1 VARCHAR(255) NOT NULL,
  column2 TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;
});

// SQL Shortcut Buttons for Query Console
document.getElementById('query-sql-select-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    document.getElementById('query-input').value = `SELECT * FROM ${currentTable} LIMIT 100;`;
  } else {
    document.getElementById('query-input').value = 'SELECT * FROM table_name LIMIT 100;';
  }
});

document.getElementById('query-sql-insert-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    const columns = getColumnList();
    const values = getValuePlaceholders();
    document.getElementById('query-input').value = `INSERT INTO ${currentTable} (${columns}) VALUES (${values});`;
  } else {
    document.getElementById('query-input').value = 'INSERT INTO table_name (column1, column2) VALUES (value1, value2);';
  }
});

document.getElementById('query-sql-update-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    const condition = getPrimaryKeyCondition();
    document.getElementById('query-input').value = `UPDATE ${currentTable} SET column_name = new_value WHERE ${condition};`;
  } else {
    document.getElementById('query-input').value = 'UPDATE table_name SET column1 = value1 WHERE condition;';
  }
});

document.getElementById('query-sql-delete-btn').addEventListener('click', async () => {
  if (currentTable) {
    await updateTableSchema();
    const condition = getPrimaryKeyCondition();
    document.getElementById('query-input').value = `DELETE FROM ${currentTable} WHERE ${condition};`;
  } else {
    document.getElementById('query-input').value = 'DELETE FROM table_name WHERE condition;';
  }
});

document.getElementById('query-sql-alter-btn').addEventListener('click', () => {
  if (currentTable) {
    document.getElementById('query-input').value = `ALTER TABLE ${currentTable} ADD COLUMN new_column_name VARCHAR(255);`;
  } else {
    document.getElementById('query-input').value = 'ALTER TABLE table_name ADD COLUMN new_column_name VARCHAR(255);';
  }
});

document.getElementById('query-sql-create-btn').addEventListener('click', () => {
  const newTableName = currentTable ? `${currentTable}_new` : 'new_table_name';
  document.getElementById('query-input').value = `CREATE TABLE ${newTableName} (
  id INT PRIMARY KEY AUTO_INCREMENT,
  column1 VARCHAR(255) NOT NULL,
  column2 TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;
});

// Open query console
document.getElementById('open-query-btn').addEventListener('click', () => {
  if (currentTable) {
    // Pre-fill query with SELECT statement for the current table
    document.getElementById('query-input').value = `SELECT * FROM ${currentTable} LIMIT 100;`;
  } else if (currentDatabase) {
    // If no table is selected but we have a database, leave the query input empty
    document.getElementById('query-input').value = '';
  } else {
    // If no database is selected, show a message
    document.getElementById('query-input').value = '-- Select a database first to run queries';
  }
  // Always show the query screen
  showScreen('query-screen');
});

// Browser query panel functionality
document.getElementById('browser-run-query-btn').addEventListener('click', async () => {
  const query = document.getElementById('browser-query-input').value.trim();
  if (!query) return;
  
  const resultsHeader = document.getElementById('browser-results-header');
  const resultsBody = document.getElementById('browser-results-body');
  const errorElement = document.getElementById('browser-query-error');
  const exportBtn = document.getElementById('browser-export-csv-btn');
  
  resultsHeader.innerHTML = '';
  resultsBody.innerHTML = '<tr><td colspan="10" class="loading"><i class="fas fa-spinner fa-spin"></i> Running query...</td></tr>';
  errorElement.textContent = '';
  errorElement.style.display = 'none';
  exportBtn.disabled = true;
  
  // Track query execution time
  const startTime = performance.now();
  
  try {
    const result = await window.api.executeQuery({
      connectionId: currentConnectionId,
      query
    });
    
    // Calculate execution time
    const executionTime = ((performance.now() - startTime) / 1000).toFixed(2);
    
    if (!result.success) {
      throw new Error(result.error || 'Query execution failed');
    }
    
    // Store the result for export
    window.browserQueryResults = result.results;
    
    // Enable export buttons
    exportBtn.disabled = false;
    document.getElementById('browser-export-excel-btn').disabled = false;
    document.getElementById('browser-export-json-btn').disabled = false;
    
    // Clear loading indicator
    resultsBody.innerHTML = '';
    
    // Display results
    // Clear loading indicator
    document.getElementById('results-body').innerHTML = '';
    
    if (Array.isArray(result.results) && result.results.length > 0) {
      // Get column names from first result
      const columns = Object.keys(result.results[0]);
      
      // Create header
      const headerRow = document.createElement('tr');
      columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
      });
      resultsHeader.appendChild(headerRow);
      
      // Create rows
      result.results.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach(column => {
          const td = document.createElement('td');
          
          if (row[column] === null) {
            td.innerHTML = '<span class="null-value">NULL</span>';
            td.classList.add('null-value');
          } else if (typeof row[column] === 'number') {
            td.textContent = row[column];
            td.classList.add('number-value');
          } else if (typeof row[column] === 'string' && row[column].length > 100) {
            // Truncate long text values
            td.innerHTML = `<div class="truncated-value" title="${row[column]}">${row[column].substring(0, 100)}...</div>`;
            td.classList.add('long-text');
          } else {
            td.textContent = row[column];
          }
          
          tr.appendChild(td);
        });
        resultsBody.appendChild(tr);
      });
      
      // Show execution time
      const infoRow = document.createElement('tr');
      const infoCell = document.createElement('td');
      infoCell.colSpan = columns.length;
      infoCell.className = 'query-info';
      infoCell.innerHTML = `<i class="fas fa-clock"></i> Query executed in ${executionTime}s with ${result.results.length} results`;
      infoRow.appendChild(infoCell);
      resultsBody.appendChild(infoRow);
    } else {
      resultsBody.innerHTML = 
        '<tr><td class="no-results"><i class="fas fa-info-circle"></i> Query executed successfully in ' + executionTime + 's. No results to display.</td></tr>';
    }
  } catch (error) {
    console.error('Error executing query:', error);
    resultsBody.innerHTML = '';
    errorElement.textContent = error.message;
    errorElement.style.display = 'block';
    errorElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${error.message}`;
  }
});

document.getElementById('browser-export-csv-btn').addEventListener('click', async () => {
  if (!window.browserQueryResults || window.browserQueryResults.length === 0) return;
  
  try {
    const result = await window.api.exportToCsv({
      data: window.browserQueryResults,
      filename: `${currentDatabase}_browser_export.csv`
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    alert(`Data exported successfully to ${result.filePath}`);
  } catch (error) {
    alert(`Export error: ${error.message}`);
  }
});

document.getElementById('browser-export-excel-btn').addEventListener('click', async () => {
  if (!window.browserQueryResults || window.browserQueryResults.length === 0) return;
  
  try {
    const result = await window.api.exportToExcel({
      data: window.browserQueryResults,
      filename: `${currentDatabase}_browser_export.xlsx`
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    alert(`Data exported successfully to ${result.filePath}`);
  } catch (error) {
    alert(`Export error: ${error.message}`);
  }
});

document.getElementById('browser-export-json-btn').addEventListener('click', async () => {
  if (!window.browserQueryResults || window.browserQueryResults.length === 0) return;
  
  try {
    const result = await window.api.exportToJson({
      data: window.browserQueryResults,
      filename: `${currentDatabase}_browser_export.json`
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    alert(`Data exported successfully to ${result.filePath}`);
  } catch (error) {
    alert(`Export error: ${error.message}`);
  }
});

// Query Screen
document.getElementById('back-to-browser-btn').addEventListener('click', () => {
  showScreen('browser-screen');
});

// Clear full query button
document.getElementById('clear-full-query-btn').addEventListener('click', () => {
  document.getElementById('query-input').value = '';
});

// Save query button
document.getElementById('save-query-btn').addEventListener('click', () => {
  const queryText = document.getElementById('query-input').value.trim();
  if (queryText) {
    const savedQueries = JSON.parse(localStorage.getItem('savedQueries') || '[]');
    const queryName = prompt('Enter a name for this query:');
    if (queryName) {
      savedQueries.push({ name: queryName, query: queryText });
      localStorage.setItem('savedQueries', JSON.stringify(savedQueries));
      alert('Query saved successfully!');
    }
  } else {
    alert('Please enter a query to save.');
  }
});



// Run query
document.getElementById('run-query-btn').addEventListener('click', async () => {
  const queryInput = document.getElementById('query-input');
  const query = queryInput.value.trim();
  
  if (!query) {
    return;
  }
  
  try {
    // Clear previous results
    document.getElementById('results-header').innerHTML = '';
    document.getElementById('results-body').innerHTML = '';
    document.getElementById('query-error').style.display = 'none';
    document.getElementById('export-csv-btn').disabled = true;
    
    // Show loading indicator
    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.className = 'loading-cell';
    loadingCell.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executing query...';
    loadingCell.colSpan = 100; // Ensure it spans across the entire table
    loadingRow.appendChild(loadingCell);
    document.getElementById('results-body').appendChild(loadingRow);
    
    // Execute query
    const result = await window.api.executeQuery({
      connectionId: currentConnectionId,
      query
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Query execution failed');
    }
    
    // Add to history
    addToQueryHistory(query);
    
    // Display results
    if (Array.isArray(result.results) && result.results.length > 0) {
      // Get column names from first result
      const columns = Object.keys(result.results[0]);
      
      // Create header
      const headerRow = document.createElement('tr');
      columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        th.title = column; // Add tooltip for column name
        
        // Set width based on content type
        if (column.toLowerCase().includes('id')) {
          th.style.width = '80px';
        } else if (column.toLowerCase().includes('date') || column.toLowerCase().includes('time')) {
          th.style.width = '150px';
        } else if (column.toLowerCase().includes('name') || column.toLowerCase().includes('title')) {
          th.style.width = '200px';
        }
        
        headerRow.appendChild(th);
      });
      document.getElementById('results-header').appendChild(headerRow);
      
      // Clear loading indicator
      document.getElementById('results-body').innerHTML = '';
      
      // Create rows
      const tbody = document.getElementById('results-body');
      result.results.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach((column, columnIndex) => {
          const td = document.createElement('td');
          const rawValue = row[column];
          const value = rawValue !== null ? String(rawValue) : 'NULL';
          
          // Format the value based on its type and column name
          let displayValue = value;
          
          // Format dates
          if ((column.toLowerCase().includes('date') || column.toLowerCase().includes('created_at') || column.toLowerCase().includes('updated_at')) && value !== 'NULL') {
            try {
              const date = new Date(rawValue);
              if (!isNaN(date.getTime())) {
                displayValue = date.toLocaleDateString();
                td.classList.add('date-value');
              }
            } catch (e) {
              // Keep original value if date parsing fails
            }
          }
          
          // Format timestamps
          if ((column.toLowerCase().includes('time') || column.toLowerCase().includes('timestamp')) && !column.toLowerCase().includes('date') && value !== 'NULL') {
            try {
              const date = new Date(rawValue);
              if (!isNaN(date.getTime())) {
                displayValue = date.toLocaleString();
                td.classList.add('timestamp-value');
              }
            } catch (e) {
              // Keep original value if date parsing fails
            }
          }
          
          // Handle boolean values
          if (value === 'true' || value === 'false') {
            td.classList.add(value === 'true' ? 'boolean-true' : 'boolean-false');
            displayValue = value === 'true' ? '✓' : '✗';
          }
          
          // Handle numeric values
          if (!isNaN(rawValue) && typeof rawValue === 'number') {
            td.classList.add('number-value');
            td.style.textAlign = 'right';
            
            // Format numbers with thousands separator
            if (Math.abs(rawValue) >= 1000) {
              displayValue = rawValue.toLocaleString();
            }
          }
          
          // Handle NULL values
          if (value === 'NULL') {
            td.innerHTML = '<span class="null-value">NULL</span>';
            td.classList.add('null-value');
          } else {
            // Handle long text content
            td.textContent = displayValue;
            td.title = value; // Add tooltip for cell content
            
            // Add a visual indicator for cells with potentially truncated content
            if (value.length > 50) {
              td.classList.add('truncated-cell');
              
              // Add click event to show full content
              td.addEventListener('click', function() {
                showCellContent(column, value);
              });
              td.style.cursor = 'pointer';
            }
          }
          
          // Add special styling for first column (usually ID or primary key)
          if (columnIndex === 0) {
            td.classList.add('primary-column');
          }
          
          // Add special styling for ID columns
          if (column.toLowerCase().includes('id') && !isNaN(rawValue)) {
            td.classList.add('id-column');
          }
          
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      
      // Update results count
      document.getElementById('results-count').textContent = `${result.results.length} rows`;
      
      // Enable export buttons
      document.getElementById('export-csv-btn').disabled = false;
      document.getElementById('export-excel-btn').disabled = false;
      document.getElementById('export-json-btn').disabled = false;
      
      // Store results for export
      window.queryResults = result.results;
    } else {
      // Clear loading indicator
      document.getElementById('results-body').innerHTML = '';
      
      // Create empty state message
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.className = 'empty-message';
      emptyCell.innerHTML = '<i class="fas fa-info-circle"></i> Query executed successfully. No results to display.';
      emptyCell.colSpan = 100; // Ensure it spans across the entire table
      emptyRow.appendChild(emptyCell);
      document.getElementById('results-body').appendChild(emptyRow);
      
      // Update results count
      document.getElementById('results-count').textContent = '0 rows';
      
      // Show execution time
      if (result.executionTime) {
        document.getElementById('query-time').textContent = `${result.executionTime} ms`;
      }
    }
  } catch (error) {
    console.error('Error executing query:', error);
    document.getElementById('query-error').textContent = error.message;
    document.getElementById('query-error').style.display = 'block';
  }
});

// Function stub to maintain compatibility
function addToQueryHistory(query) {
  // Query history functionality has been removed
  // This function is kept as a stub to avoid breaking existing code
  console.log('Query executed:', query);
}

// Show full cell content in a modal
function showCellContent(columnName, content) {
  // Create modal container if it doesn't exist
  let modal = document.getElementById('cell-content-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cell-content-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
    
    // Close when clicking outside the modal content
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
  
  // Create or update modal content
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${columnName}</h3>
        <span class="close-modal">&times;</span>
      </div>
      <div class="modal-body">
        <pre>${content}</pre>
      </div>
    </div>
  `;
  
  // Add close button functionality
  modal.querySelector('.close-modal').addEventListener('click', function() {
    modal.style.display = 'none';
  });
  
  // Show the modal
  modal.style.display = 'block';
}



// Export to CSV
document.getElementById('export-csv-btn').addEventListener('click', async () => {
  if (!window.queryResults || window.queryResults.length === 0) {
    return;
  }
  
  try {
    const result = await window.api.exportToCsv({
      data: window.queryResults,
      filename: `${currentDatabase}_${currentTable}_export.csv`
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Show success message
    alert(`Results exported to ${result.filePath}`);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    alert(`Export failed: ${error.message}`);
  }
});

// Export to Excel
document.getElementById('export-excel-btn').addEventListener('click', async () => {
  if (!window.queryResults || window.queryResults.length === 0) {
    return;
  }
  
  try {
    const result = await window.api.exportToExcel({
      data: window.queryResults,
      filename: `${currentDatabase}_${currentTable}_export.xlsx`
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Show success message
    alert(`Results exported to ${result.filePath}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert(`Export failed: ${error.message}`);
  }
});

// Export to JSON
document.getElementById('export-json-btn').addEventListener('click', async () => {
  if (!window.queryResults || window.queryResults.length === 0) {
    return;
  }
  
  try {
    const result = await window.api.exportToJson({
      data: window.queryResults,
      filename: `${currentDatabase}_${currentTable}_export.json`
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Show success message
    alert(`Results exported to ${result.filePath}`);
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    alert(`Export failed: ${error.message}`);
  }
});

// Show error message
function showError(message) {
  // Check if there's already an error message
  const existingError = document.querySelector('.error-toast');
  if (existingError) {
    existingError.remove();
  }
  
  const errorElement = document.createElement('div');
  errorElement.classList.add('error-toast', 'fade-in');
  errorElement.innerHTML = `
    <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
    <div class="error-content">${message}</div>
    <button class="error-close"><i class="fas fa-times"></i></button>
  `;
  
  // Add close button functionality
  const closeBtn = errorElement.querySelector('.error-close');
  closeBtn.addEventListener('click', () => {
    errorElement.classList.add('fade-out');
    setTimeout(() => {
      errorElement.remove();
    }, 300);
  });
  
  // Add to body
  document.body.appendChild(errorElement);
  
  // Remove after 5 seconds
  setTimeout(() => {
    errorElement.classList.add('fade-out');
    setTimeout(() => {
      errorElement.remove();
    }, 300);
  }, 5000);
}

// Initialize the application
updateConnectionForm();