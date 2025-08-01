#!/usr/bin/env python3
"""
MySQL Database Benchmark Tool

This script benchmarks the performance of a MySQL database by running a series of
queries and measuring their execution time. It helps identify performance bottlenecks
and provides suggestions for optimization.

Usage:
    python benchmark_database.py [options]

Options:
    --host HOST         MySQL host (default: localhost)
    --port PORT         MySQL port (default: 3306)
    --user USER         MySQL username (default: root)
    --password PASS     MySQL password
    --database DB       Database name (default: ecommerce_demo)
    --iterations N      Number of iterations for each test (default: 3)
    --output FILE       Output report file (default: benchmark_report.html)
    --help              Show this help message
"""

import argparse
import getpass
import time
import datetime
import statistics
import sys
import mysql.connector
from mysql.connector import Error

# Define benchmark queries
BENCHMARK_QUERIES = [
    {
        "name": "Simple SELECT",
        "description": "Retrieves all customers",
        "query": "SELECT * FROM customers LIMIT 1000;",
        "category": "Basic"
    },
    {
        "name": "Filtered SELECT",
        "description": "Retrieves active customers",
        "query": "SELECT * FROM customers WHERE status = 'Active' LIMIT 1000;",
        "category": "Basic"
    },
    {
        "name": "COUNT",
        "description": "Counts total number of products",
        "query": "SELECT COUNT(*) FROM products;",
        "category": "Basic"
    },
    {
        "name": "Simple JOIN",
        "description": "Joins customers and orders",
        "query": "SELECT c.customer_id, c.first_name, c.last_name, o.order_id, o.order_date " +
                 "FROM customers c JOIN orders o ON c.customer_id = o.customer_id LIMIT 1000;",
        "category": "Intermediate"
    },
    {
        "name": "Multi-table JOIN",
        "description": "Joins customers, orders, and order items",
        "query": "SELECT c.customer_id, c.first_name, c.last_name, o.order_id, oi.product_id, oi.quantity " +
                 "FROM customers c " +
                 "JOIN orders o ON c.customer_id = o.customer_id " +
                 "JOIN order_items oi ON o.order_id = oi.order_id LIMIT 1000;",
        "category": "Intermediate"
    },
    {
        "name": "Aggregation",
        "description": "Calculates total sales by customer",
        "query": "SELECT c.customer_id, c.first_name, c.last_name, SUM(o.total_amount) as total_spent " +
                 "FROM customers c " +
                 "JOIN orders o ON c.customer_id = o.customer_id " +
                 "GROUP BY c.customer_id, c.first_name, c.last_name " +
                 "ORDER BY total_spent DESC LIMIT 100;",
        "category": "Intermediate"
    },
    {
        "name": "Subquery",
        "description": "Finds products with above-average price",
        "query": "SELECT product_id, name, price FROM products " +
                 "WHERE price > (SELECT AVG(price) FROM products) " +
                 "ORDER BY price DESC LIMIT 100;",
        "category": "Advanced"
    },
    {
        "name": "Complex JOIN with Filtering",
        "description": "Finds top-rated products with their categories and review stats",
        "query": "SELECT p.product_id, p.name, c.name as category, " +
                 "AVG(r.rating) as avg_rating, COUNT(r.review_id) as review_count " +
                 "FROM products p " +
                 "JOIN categories c ON p.category_id = c.category_id " +
                 "JOIN reviews r ON p.product_id = r.product_id " +
                 "GROUP BY p.product_id, p.name, c.name " +
                 "HAVING avg_rating >= 4 AND review_count >= 3 " +
                 "ORDER BY avg_rating DESC, review_count DESC LIMIT 100;",
        "category": "Advanced"
    },
    {
        "name": "Date Range Query",
        "description": "Analyzes orders within a date range",
        "query": "SELECT DATE(order_date) as order_day, COUNT(*) as order_count, " +
                 "SUM(total_amount) as daily_revenue " +
                 "FROM orders " +
                 "WHERE order_date BETWEEN DATE_SUB(NOW(), INTERVAL 90 DAY) AND NOW() " +
                 "GROUP BY order_day " +
                 "ORDER BY order_day DESC;",
        "category": "Advanced"
    },
    {
        "name": "Full Text Search",
        "description": "Searches product descriptions (requires FULLTEXT index)",
        "query": "SELECT product_id, name, description FROM products " +
                 "WHERE MATCH(description) AGAINST('premium quality' IN NATURAL LANGUAGE MODE) LIMIT 100;",
        "category": "Advanced",
        "optional": True
    },
    {
        "name": "View Query",
        "description": "Queries the product_sales_summary view",
        "query": "SELECT * FROM product_sales_summary ORDER BY total_revenue DESC LIMIT 100;",
        "category": "View",
        "optional": True
    },
    {
        "name": "Stored Procedure",
        "description": "Calls get_product_sales_by_date_range procedure",
        "query": "CALL get_product_sales_by_date_range(DATE_SUB(NOW(), INTERVAL 30 DAY), NOW());",
        "category": "Procedure",
        "optional": True
    }
]

# Define optimization suggestions based on query performance
OPTIMIZATION_SUGGESTIONS = {
    "Simple SELECT": [
        "Ensure proper indexing on frequently queried columns",
        "Consider using column-specific SELECT instead of SELECT *",
        "Check if table partitioning would help for very large tables"
    ],
    "Filtered SELECT": [
        "Add an index on the status column if not already present",
        "Consider using ENUM type for status fields to save space",
        "Verify that the WHERE clause uses indexed columns"
    ],
    "COUNT": [
        "For approximate counts, consider using information_schema.tables",
        "For large tables, maintain a separate counter table that's updated with triggers",
        "Use COUNT(1) instead of COUNT(*) for slight performance improvement"
    ],
    "Simple JOIN": [
        "Ensure foreign keys are properly indexed",
        "Check join order optimization in EXPLAIN plan",
        "Consider denormalizing frequently joined data for read-heavy operations"
    ],
    "Multi-table JOIN": [
        "Ensure all join columns are indexed",
        "Consider creating composite indexes for multi-column joins",
        "Use EXPLAIN to verify the join order and optimization",
        "For reporting queries, consider materialized views or summary tables"
    ],
    "Aggregation": [
        "Add indexes on grouped columns and columns in the WHERE clause",
        "Consider pre-aggregating data for common aggregation queries",
        "Use HAVING only for filtering on aggregated values, not for row filtering"
    ],
    "Subquery": [
        "Check if the subquery can be rewritten as a JOIN for better performance",
        "Use EXPLAIN to verify if the subquery is materialized or executed for each row",
        "Consider using a derived table or CTE instead of a subquery"
    ],
    "Complex JOIN with Filtering": [
        "Ensure all join columns and filtered columns are indexed",
        "Consider creating a summary table for this specific query pattern",
        "Use EXPLAIN to identify bottlenecks in the execution plan",
        "Consider breaking down the query into smaller parts using temporary tables"
    ],
    "Date Range Query": [
        "Ensure the order_date column is indexed",
        "Consider partitioning large tables by date ranges",
        "Pre-aggregate historical data for faster reporting"
    ],
    "Full Text Search": [
        "Add a FULLTEXT index on the description column",
        "Consider using a dedicated search engine like Elasticsearch for complex text search",
        "Optimize FULLTEXT index settings based on your content"
    ],
    "View Query": [
        "Consider materializing complex views for better performance",
        "Ensure the underlying tables in the view are properly indexed",
        "Monitor view performance and consider rewriting as a stored procedure if needed"
    ],
    "Stored Procedure": [
        "Optimize the internal queries within the stored procedure",
        "Consider caching procedure results for frequent calls with the same parameters",
        "Use proper parameter types and validate inputs to avoid performance issues"
    ]
}

# General database optimization suggestions
GENERAL_SUGGESTIONS = [
    "Ensure InnoDB buffer pool size is set appropriately (typically 70-80% of available memory)",
    "Enable query caching for read-heavy workloads",
    "Optimize table structure by using appropriate data types and normalization level",
    "Regularly run ANALYZE TABLE to update index statistics",
    "Consider using connection pooling for applications with many concurrent connections",
    "Monitor slow queries and optimize them based on EXPLAIN output",
    "Use proper indexing strategy (covering indexes, composite indexes) based on query patterns",
    "Consider partitioning large tables based on access patterns",
    "Regularly maintain and optimize your database with OPTIMIZE TABLE",
    "For read-heavy workloads, consider using read replicas"
]


def connect_to_database(host, port, user, password, database):
    """Connect to the MySQL database"""
    try:
        connection = mysql.connector.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database
        )
        if connection.is_connected():
            return connection
    except Error as e:
        print(f"Error connecting to MySQL database: {e}")
        sys.exit(1)


def run_benchmark(connection, iterations=3):
    """Run benchmark queries and measure performance"""
    results = []
    cursor = connection.cursor()
    
    for query_info in BENCHMARK_QUERIES:
        query_name = query_info["name"]
        query = query_info["query"]
        optional = query_info.get("optional", False)
        
        print(f"Running benchmark: {query_name}")
        
        # Skip optional queries if they fail (e.g., missing FULLTEXT index)
        if optional:
            try:
                cursor.execute(query)
                cursor.fetchall()  # Test if query works
            except Error as e:
                print(f"  Skipping optional query '{query_name}': {e}")
                continue
        
        execution_times = []
        row_counts = []
        
        for i in range(iterations):
            try:
                start_time = time.time()
                cursor.execute(query)
                rows = cursor.fetchall()
                end_time = time.time()
                
                execution_time = end_time - start_time
                row_count = len(rows)
                
                execution_times.append(execution_time)
                row_counts.append(row_count)
                
                print(f"  Iteration {i+1}: {execution_time:.4f} seconds, {row_count} rows")
                
            except Error as e:
                print(f"  Error executing query: {e}")
                if not optional:
                    execution_times.append(None)
                    row_counts.append(None)
                break
        
        # Calculate statistics if we have valid execution times
        valid_times = [t for t in execution_times if t is not None]
        if valid_times:
            avg_time = statistics.mean(valid_times)
            min_time = min(valid_times)
            max_time = max(valid_times)
            if len(valid_times) > 1:
                std_dev = statistics.stdev(valid_times)
            else:
                std_dev = 0
                
            results.append({
                "name": query_name,
                "description": query_info["description"],
                "query": query,
                "category": query_info["category"],
                "avg_time": avg_time,
                "min_time": min_time,
                "max_time": max_time,
                "std_dev": std_dev,
                "row_count": statistics.mean(row_counts) if any(rc is not None for rc in row_counts) else 0,
                "iterations": len(valid_times),
                "suggestions": OPTIMIZATION_SUGGESTIONS.get(query_name, [])
            })
    
    cursor.close()
    return results


def get_database_stats(connection):
    """Get database statistics"""
    stats = {}
    cursor = connection.cursor(dictionary=True)
    
    # Get table statistics
    try:
        cursor.execute("""
            SELECT 
                table_name, 
                table_rows, 
                data_length, 
                index_length,
                data_free,
                create_time,
                update_time
            FROM 
                information_schema.tables 
            WHERE 
                table_schema = DATABASE()
        """)
        stats["tables"] = cursor.fetchall()
    except Error as e:
        print(f"Error getting table statistics: {e}")
        stats["tables"] = []
    
    # Get index statistics
    try:
        cursor.execute("""
            SELECT 
                table_name, 
                index_name, 
                column_name,
                seq_in_index,
                non_unique
            FROM 
                information_schema.statistics 
            WHERE 
                table_schema = DATABASE()
            ORDER BY 
                table_name, index_name, seq_in_index
        """)
        stats["indexes"] = cursor.fetchall()
    except Error as e:
        print(f"Error getting index statistics: {e}")
        stats["indexes"] = []
    
    # Get server variables
    try:
        cursor.execute("SHOW VARIABLES LIKE 'innodb_buffer_pool_size'")
        buffer_pool = cursor.fetchone()
        stats["buffer_pool_size"] = int(buffer_pool["Value"]) if buffer_pool else 0
        
        cursor.execute("SHOW VARIABLES LIKE 'max_connections'")
        max_conn = cursor.fetchone()
        stats["max_connections"] = int(max_conn["Value"]) if max_conn else 0
        
        cursor.execute("SHOW VARIABLES LIKE 'query_cache_size'")
        query_cache = cursor.fetchone()
        stats["query_cache_size"] = int(query_cache["Value"]) if query_cache else 0
    except Error as e:
        print(f"Error getting server variables: {e}")
    
    cursor.close()
    return stats


def generate_report(results, stats, output_file):
    """Generate HTML benchmark report"""
    # Sort results by average execution time (slowest first)
    sorted_results = sorted(results, key=lambda x: x["avg_time"], reverse=True)
    
    # Group results by category
    categorized_results = {}
    for result in results:
        category = result["category"]
        if category not in categorized_results:
            categorized_results[category] = []
        categorized_results[category].append(result)
    
    # Calculate total data size
    total_data_size = sum(table["data_length"] + table["index_length"] for table in stats["tables"])
    
    # Generate HTML report
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MySQL Database Benchmark Report</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }}
            h1, h2, h3 {{
                color: #2c3e50;
            }}
            h1 {{
                text-align: center;
                margin-bottom: 30px;
            }}
            h2 {{
                border-bottom: 1px solid #eee;
                padding-bottom: 10px;
                margin-top: 30px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }}
            th, td {{
                padding: 12px 15px;
                border: 1px solid #ddd;
                text-align: left;
            }}
            th {{
                background-color: #f8f9fa;
                font-weight: bold;
            }}
            tr:nth-child(even) {{
                background-color: #f2f2f2;
            }}
            .slow {{
                background-color: #ffcccc;
            }}
            .medium {{
                background-color: #ffffcc;
            }}
            .fast {{
                background-color: #ccffcc;
            }}
            .chart-container {{
                height: 400px;
                margin-bottom: 30px;
            }}
            .suggestion {{
                background-color: #f8f9fa;
                border-left: 4px solid #3498db;
                padding: 10px 15px;
                margin-bottom: 10px;
            }}
            .suggestion-list {{
                margin-top: 5px;
                margin-bottom: 5px;
            }}
            .query {{
                font-family: monospace;
                background-color: #f8f9fa;
                padding: 10px;
                border: 1px solid #ddd;
                overflow-x: auto;
                white-space: pre-wrap;
            }}
            .summary-box {{
                background-color: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 20px;
            }}
            .summary-item {{
                display: inline-block;
                margin-right: 30px;
                margin-bottom: 10px;
            }}
            .summary-label {{
                font-weight: bold;
                color: #7f8c8d;
            }}
            .summary-value {{
                font-size: 1.2em;
                font-weight: bold;
                color: #2c3e50;
            }}
            .footer {{
                margin-top: 50px;
                text-align: center;
                color: #7f8c8d;
                font-size: 0.9em;
            }}
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
        <h1>MySQL Database Benchmark Report</h1>
        <p>Report generated on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        
        <div class="summary-box">
            <h3>Summary</h3>
            <div>
                <div class="summary-item">
                    <div class="summary-label">Total Queries Tested</div>
                    <div class="summary-value">{len(results)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Slowest Query</div>
                    <div class="summary-value">{sorted_results[0]['name'] if sorted_results else 'N/A'}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Fastest Query</div>
                    <div class="summary-value">{sorted_results[-1]['name'] if sorted_results else 'N/A'}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Tables</div>
                    <div class="summary-value">{len(stats['tables'])}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Database Size</div>
                    <div class="summary-value">{format_size(total_data_size)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Buffer Pool Size</div>
                    <div class="summary-value">{format_size(stats.get('buffer_pool_size', 0))}</div>
                </div>
            </div>
        </div>
        
        <h2>Performance Overview</h2>
        <div class="chart-container">
            <canvas id="queryPerformanceChart"></canvas>
        </div>
        
        <h2>Query Performance Results</h2>
    """
    
    # Add results by category
    for category, category_results in categorized_results.items():
        # Sort by average execution time (slowest first)
        category_results = sorted(category_results, key=lambda x: x["avg_time"], reverse=True)
        
        html += f"""
        <h3>{category} Queries</h3>
        <table>
            <thead>
                <tr>
                    <th>Query</th>
                    <th>Description</th>
                    <th>Avg Time (s)</th>
                    <th>Min Time (s)</th>
                    <th>Max Time (s)</th>
                    <th>Std Dev</th>
                    <th>Rows</th>
                </tr>
            </thead>
            <tbody>
        """
        
        for result in category_results:
            # Determine performance class based on average time
            perf_class = ""
            if result["avg_time"] > 1.0:
                perf_class = "slow"
            elif result["avg_time"] > 0.1:
                perf_class = "medium"
            else:
                perf_class = "fast"
            
            html += f"""
                <tr class="{perf_class}">
                    <td>{result['name']}</td>
                    <td>{result['description']}</td>
                    <td>{result['avg_time']:.4f}</td>
                    <td>{result['min_time']:.4f}</td>
                    <td>{result['max_time']:.4f}</td>
                    <td>{result['std_dev']:.4f}</td>
                    <td>{int(result['row_count'])}</td>
                </tr>
            """
        
        html += """
            </tbody>
        </table>
        """
    
    # Add detailed query analysis
    html += """
        <h2>Detailed Query Analysis</h2>
    """
    
    for result in sorted_results:
        html += f"""
        <h3>{result['name']}</h3>
        <p>{result['description']}</p>
        
        <div class="query">{result['query']}</div>
        
        <p><strong>Performance:</strong> {result['avg_time']:.4f} seconds (avg), {result['min_time']:.4f} seconds (min), {result['max_time']:.4f} seconds (max)</p>
        
        <h4>Optimization Suggestions</h4>
        <div class="suggestion-list">
        """
        
        for suggestion in result["suggestions"]:
            html += f"""
            <div class="suggestion">{suggestion}</div>
            """
        
        html += """
        </div>
        """
    
    # Add database statistics
    html += """
        <h2>Database Statistics</h2>
        
        <h3>Table Statistics</h3>
        <table>
            <thead>
                <tr>
                    <th>Table Name</th>
                    <th>Rows</th>
                    <th>Data Size</th>
                    <th>Index Size</th>
                    <th>Total Size</th>
                    <th>Created</th>
                    <th>Last Updated</th>
                </tr>
            </thead>
            <tbody>
    """
    
    for table in sorted(stats["tables"], key=lambda x: x["table_name"]):
        data_size = table["data_length"]
        index_size = table["index_length"]
        total_size = data_size + index_size
        
        html += f"""
                <tr>
                    <td>{table['table_name']}</td>
                    <td>{table['table_rows'] or 0}</td>
                    <td>{format_size(data_size)}</td>
                    <td>{format_size(index_size)}</td>
                    <td>{format_size(total_size)}</td>
                    <td>{table['create_time'].strftime('%Y-%m-%d %H:%M:%S') if table['create_time'] else 'N/A'}</td>
                    <td>{table['update_time'].strftime('%Y-%m-%d %H:%M:%S') if table['update_time'] else 'N/A'}</td>
                </tr>
        """
    
    html += """
            </tbody>
        </table>
        
        <h3>Index Statistics</h3>
        <table>
            <thead>
                <tr>
                    <th>Table Name</th>
                    <th>Index Name</th>
                    <th>Column Name</th>
                    <th>Sequence</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
    """
    
    for index in sorted(stats["indexes"], key=lambda x: (x["table_name"], x["index_name"], x["seq_in_index"])):
        index_type = "Non-unique" if index["non_unique"] == 1 else "Unique"
        if index["index_name"] == "PRIMARY":
            index_type = "Primary Key"
        
        html += f"""
                <tr>
                    <td>{index['table_name']}</td>
                    <td>{index['index_name']}</td>
                    <td>{index['column_name']}</td>
                    <td>{index['seq_in_index']}</td>
                    <td>{index_type}</td>
                </tr>
        """
    
    html += """
            </tbody>
        </table>
        
        <h2>General Optimization Suggestions</h2>
        <div class="suggestion-list">
    """
    
    for suggestion in GENERAL_SUGGESTIONS:
        html += f"""
        <div class="suggestion">{suggestion}</div>
        """
    
    html += """
        </div>
        
        <script>
            // Create performance chart
            const ctx = document.getElementById('queryPerformanceChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [%s],
                    datasets: [{
                        label: 'Average Execution Time (seconds)',
                        data: [%s],
                        backgroundColor: [%s],
                        borderColor: [%s],
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Execution Time (seconds)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.parsed.x.toFixed(4)} seconds`;
                                }
                            }
                        }
                    }
                }
            });
        </script>
        
        <div class="footer">
            <p>MySQL Database Benchmark Report - Generated on %s</p>
        </div>
    </body>
    </html>
    """ % (
        # Chart labels
        ', '.join([f"'{result['name']}'" for result in sorted_results]),
        # Chart data
        ', '.join([f"{result['avg_time']}" for result in sorted_results]),
        # Chart background colors
        ', '.join(["'rgba(255, 99, 132, 0.2)'" if result['avg_time'] > 1.0 else 
                   "'rgba(255, 205, 86, 0.2)'" if result['avg_time'] > 0.1 else 
                   "'rgba(75, 192, 192, 0.2)'" for result in sorted_results]),
        # Chart border colors
        ', '.join(["'rgb(255, 99, 132)'" if result['avg_time'] > 1.0 else 
                   "'rgb(255, 205, 86)'" if result['avg_time'] > 0.1 else 
                   "'rgb(75, 192, 192)'" for result in sorted_results]),
        # Footer date
        datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    )
    
    with open(output_file, 'w') as f:
        f.write(html)
    
    print(f"Benchmark report generated: {output_file}")


def format_size(size_bytes):
    """Format size in bytes to human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0 or unit == 'TB':
            break
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} {unit}"


def main():
    parser = argparse.ArgumentParser(description="Benchmark MySQL database performance")
    parser.add_argument("--host", type=str, default="localhost", help="MySQL host")
    parser.add_argument("--port", type=int, default=3306, help="MySQL port")
    parser.add_argument("--user", type=str, default="root", help="MySQL username")
    parser.add_argument("--password", type=str, help="MySQL password")
    parser.add_argument("--database", type=str, default="ecommerce_demo", help="Database name")
    parser.add_argument("--iterations", type=int, default=3, help="Number of iterations for each test")
    parser.add_argument("--output", type=str, default="benchmark_report.html", help="Output report file")
    parser.add_argument("--help", action="store_true", help="Show help message")
    
    args = parser.parse_args()
    
    if args.help:
        parser.print_help()
        sys.exit(0)
    
    # Get password if not provided
    password = args.password
    if password is None:
        password = getpass.getpass("Enter MySQL password: ")
    
    print(f"Connecting to MySQL database {args.database} on {args.host}:{args.port}...")
    connection = connect_to_database(args.host, args.port, args.user, password, args.database)
    
    print(f"Running benchmark with {args.iterations} iterations per query...")
    results = run_benchmark(connection, args.iterations)
    
    print("Collecting database statistics...")
    stats = get_database_stats(connection)
    
    print("Generating benchmark report...")
    generate_report(results, stats, args.output)
    
    connection.close()
    print("Benchmark completed.")


if __name__ == "__main__":
    main()