from app import create_app
import os

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))  # Azure uses PORT
    app.run(host='0.0.0.0', port=port)