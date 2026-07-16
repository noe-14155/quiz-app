import os

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
CSV_PATH = os.path.join(DATA_DIR, "questions.csv")
DB_PATH = os.path.join(DATA_DIR, "quiz.db")
