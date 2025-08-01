# Database Manager

A desktop application built with Electron and Node.js that allows users to connect to various databases (MySQL, PostgreSQL, SQLite) and run queries via an interactive graphical interface.

## Features

- Connect to MySQL, PostgreSQL, and SQLite databases
- Browse databases and tables
- View table schemas
- Execute SQL queries
- View query results in a tabular format
- Export query results to CSV
- Save connection credentials for future use
- Query history tracking

## Application Flow

1. **Welcome Screen**: Initial landing page with a button to start connecting to a database
2. **Connection Screen**: Form to enter database connection details
3. **Database Browser**: View and select databases and tables
4. **Query Console**: Execute SQL queries and view results

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the application:

```bash
npm start
```

## Building for Distribution

To build the application for distribution:

```bash
npm run build
```

This will create platform-specific distribution files in the `dist` directory.

## Technologies Used

- **Frontend**: Electron, HTML, CSS, JavaScript
- **Backend**: Node.js
- **Database Drivers**:
  - MySQL: mysql2
  - PostgreSQL: pg
  - SQLite: sqlite3
- **Other Libraries**:
  - electron-store: For saving connection credentials

## License

ISC