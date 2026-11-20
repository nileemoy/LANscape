import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

default_db = DATA_DIR / "lanscape.db" if (DATA_DIR / "lanscape.db").exists() or not (DATA_DIR / "homenet.db").exists() else DATA_DIR / "homenet.db"
DB_PATH = os.environ.get("LANSCAPE_DB_PATH", os.environ.get("HOMENET_DB_PATH", str(default_db)))
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

