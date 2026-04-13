from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Use async MySQL driver
DATABASE_URL = settings.DATABASE_URL.replace("mysql+pymysql", "mysql+aiomysql")

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_tables():
    from app.models import user, disease, soil, market, forum, farm  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
