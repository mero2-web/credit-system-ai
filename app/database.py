from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path

# DB file next to the 'app' folder
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "credit_system.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
	DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()