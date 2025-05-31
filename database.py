# ===== database.py =====
import sqlite3
from config import Config

def init_db():
    """Initialize the database with blob storage table"""
    conn = sqlite3.connect(Config.DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            content_type TEXT,
            data BLOB NOT NULL,
            thumbnail BLOB,
            size INTEGER,
            width INTEGER,
            height INTEGER,
            is_image BOOLEAN DEFAULT 0,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(Config.DATABASE)
    conn.row_factory = sqlite3.Row
    return conn