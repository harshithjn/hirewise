from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

import config


class Base(DeclarativeBase):
    pass


def make_engine(url: str, **kw):
    if url.startswith("sqlite"):
        kw.setdefault("connect_args", {"check_same_thread": False})
    return create_engine(url, **kw)


engine = make_engine(config.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db(bind=None) -> None:
    import models  # noqa: F401

    Base.metadata.create_all(bind or engine)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
