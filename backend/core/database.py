import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv
from typing import AsyncGenerator

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
connect_args = {}

if DATABASE_URL:
    if "sslmode=require" in DATABASE_URL:
        connect_args["ssl"] = "require"
    
    # asyncpg doesn't support the URL queries typically used with psycopg2
    DATABASE_URL = DATABASE_URL.split("?")[0]
    
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
else:
    raise RuntimeError("DATABASE_URL environment variable is missing. Please set it in Render Env Vars.")

# Ensure it uses postgresql+asyncpg for asyncpg driver
engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)
AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
