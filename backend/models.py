from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class User(Base):
    __tablename__ = 'users'
    id         = Column(String, primary_key=True)
    name       = Column(String, nullable=False)
    email      = Column(String, unique=True, nullable=False)
    password   = Column(String, nullable=False)
    role       = Column(String, nullable=False, default='lecteur_dt')
    dt         = Column(String, nullable=True)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Report(Base):
    __tablename__ = 'reports'
    id           = Column(String, primary_key=True)
    title        = Column(String, nullable=False)
    description  = Column(Text)
    category     = Column(String, nullable=False)
    url          = Column(String, nullable=False)
    external     = Column(Boolean, default=True)
    owner        = Column(String)
    status       = Column(String, default='live')
    pinned       = Column(Boolean, default=False)
    tags         = Column(String)  # JSON stringified
    access_roles = Column(String)  # JSON stringified
    access_dt    = Column(String, nullable=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Alert(Base):
    __tablename__ = 'alerts'
    id         = Column(String, primary_key=True)
    title      = Column(String, nullable=False)
    message    = Column(Text)
    severity   = Column(String, default='info')
    read       = Column(Boolean, default=False)
    report_id  = Column(String, ForeignKey('reports.id'), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
