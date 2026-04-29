import pymysql
from urllib.parse import urlparse, unquote
from config import Config

def create_db():
    uri = Config.SQLALCHEMY_DATABASE_URI
    result = urlparse(uri)
    
    user = result.username
    password = unquote(result.password) if result.password else ""
    host = result.hostname
    db_name = result.path.lstrip('/')

    connection = pymysql.connect(host=host, user=user, password=password)
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        connection.commit()
        print(f"Database '{db_name}' created or already exists.")
    finally:
        connection.close()

if __name__ == '__main__':
    create_db()
