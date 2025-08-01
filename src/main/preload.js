const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Database connection
  connectDatabase: (connectionInfo) => ipcRenderer.invoke('connect-database', connectionInfo),
  getSavedCredentials: () => ipcRenderer.invoke('get-saved-credentials'),
  
  // Connection profiles
  saveConnectionProfile: (profile) => ipcRenderer.invoke('save-connection-profile', profile),
  loadConnectionProfiles: () => ipcRenderer.invoke('load-connection-profiles'),
  loadConnectionProfile: (profileName) => ipcRenderer.invoke('load-connection-profile', profileName),
  
  // Database operations
  listDatabases: (connectionId) => ipcRenderer.invoke('list-databases', connectionId),
  useDatabase: (params) => ipcRenderer.invoke('use-database', params),
  listTables: (connectionId) => ipcRenderer.invoke('list-tables', connectionId),
  getTableSchema: (params) => ipcRenderer.invoke('get-table-schema', params),
  executeQuery: (params) => ipcRenderer.invoke('execute-query', params),
  
  // Export functionality
  exportToCsv: (params) => ipcRenderer.invoke('export-to-csv', params),
  exportToExcel: (params) => ipcRenderer.invoke('export-to-excel', params),
  exportToJson: (params) => ipcRenderer.invoke('export-to-json', params),
  
  // AI SQL Assistant functionality
  getDatabaseSchema: (params) => ipcRenderer.invoke('get-database-schema', params),
  naturalLanguageToSql: (params) => ipcRenderer.invoke('nl-to-sql', params),
  
  // Connection management
  closeConnection: (connectionId) => ipcRenderer.invoke('close-connection', connectionId)
});