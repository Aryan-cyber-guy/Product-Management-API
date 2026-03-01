from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"}  # Required for Render
)
session = sessionmaker(autoflush=False,autocommit=False,bind=engine)