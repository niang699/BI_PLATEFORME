"""SEN'EAU BI Platform — API FastAPI (Phase 1)."""
import json
import os
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from database import get_db, engine, Base
from models import User, Report, Alert
from auth import (
    verify_password, create_token, hash_password,
    get_current_user, require_admin,
)
from cache import get_redis, cache_delete
from routes.kpi import router as kpi_router

# ── Job quotidien 07h00 — invalidation cache KPIs ────────────────────────────

def invalidate_kpi_cache():
    """Vide les clés seneau:* à 07h00 chaque matin (après mise à jour des vues)."""
    nb = cache_delete("seneau:*")
    print(f"[Scheduler] {datetime.now().strftime('%Y-%m-%d %H:%M')} — Cache KPIs invalidé : {nb} clé(s) supprimée(s)")

# ── Lifespan : init Redis + scheduler au démarrage ───────────────────────────

scheduler = AsyncIOScheduler(timezone="Africa/Dakar")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Démarrage
    Base.metadata.create_all(bind=engine)

    # Redis
    r = get_redis()
    if r:
        print("✓ Redis connecté — cache seneau:* prêt")
    else:
        print("⚠ Redis indisponible — mode sans cache (PostgreSQL direct)")

    # Scheduler — invalidation cache tous les jours à 07h00 (heure Dakar)
    scheduler.add_job(
        invalidate_kpi_cache,
        CronTrigger(hour=7, minute=0),
        id="invalidate_kpi_cache",
        replace_existing=True,
    )
    scheduler.start()
    print("✓ Scheduler démarré — invalidation cache KPIs tous les jours à 07h00 (Africa/Dakar)")

    yield

    # Arrêt propre
    scheduler.shutdown(wait=False)

app = FastAPI(
    title="SEN'EAU BI Platform API",
    description="API de gestion du portail BI SEN'EAU",
    version="1.0.0",
    lifespan=lifespan,
)

# Inclure le router KPI (avec cache Redis)
app.include_router(kpi_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schémas Pydantic ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email:    str
    password: str

class UserOut(BaseModel):
    id:    str
    name:  str
    email: str
    role:  str
    dt:    Optional[str] = None

    class Config:
        from_attributes = True

class ReportOut(BaseModel):
    id:          str
    title:       str
    description: Optional[str] = None
    category:    str
    url:         str
    external:    bool
    owner:       Optional[str] = None
    status:      str
    pinned:      bool
    tags:        List[str] = []

    class Config:
        from_attributes = True

class AlertOut(BaseModel):
    id:        str
    title:     str
    message:   Optional[str] = None
    severity:  str
    read:      bool
    report_id: Optional[str] = None

    class Config:
        from_attributes = True

# ── Auth ─────────────────────────────────────────────────────────────────────

@app.post('/auth/login')
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.is_active == True).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Identifiants incorrects')
    token = create_token(user.id)
    return {
        'access_token': token,
        'token_type': 'bearer',
        'user': UserOut.model_validate(user),
    }

@app.get('/auth/me', response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

# ── Utilisateurs ─────────────────────────────────────────────────────────────

@app.get('/users', response_model=List[UserOut])
def list_users(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_admin),
):
    return db.query(User).filter(User.is_active == True).all()

@app.post('/users', response_model=UserOut, status_code=201)
def create_user(
    body: dict,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_admin),
):
    import uuid
    new_user = User(
        id=str(uuid.uuid4()),
        name=body['name'],
        email=body['email'],
        password=hash_password(body['password']),
        role=body.get('role', 'lecteur_dt'),
        dt=body.get('dt'),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# ── Rapports ─────────────────────────────────────────────────────────────────

def report_to_out(r: Report) -> dict:
    return {
        'id':          r.id,
        'title':       r.title,
        'description': r.description,
        'category':    r.category,
        'url':         r.url,
        'external':    r.external,
        'owner':       r.owner,
        'status':      r.status,
        'pinned':      r.pinned,
        'tags':        json.loads(r.tags or '[]'),
    }

@app.get('/reports')
def list_reports(
    db:       Session       = Depends(get_db),
    current:  User          = Depends(get_current_user),
    pinned:   Optional[bool]= None,
    category: Optional[str] = None,
):
    q = db.query(Report)
    if pinned is not None:
        q = q.filter(Report.pinned == pinned)
    if category:
        q = q.filter(Report.category == category)

    reports = []
    for r in q.all():
        roles = json.loads(r.access_roles or '[]')
        if current.role in roles:
            # Row-Level Security par DT
            if r.access_dt:
                allowed_dt = json.loads(r.access_dt)
                if current.role not in ('super_admin', 'admin_metier') and current.dt not in allowed_dt:
                    continue
            reports.append(report_to_out(r))

    return reports

@app.get('/reports/{report_id}')
def get_report(report_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(404, 'Rapport introuvable')
    return report_to_out(r)

# ── Alertes ──────────────────────────────────────────────────────────────────

@app.get('/alerts')
def list_alerts(
    db:      Session = Depends(get_db),
    user:    User    = Depends(get_current_user),
    unread:  bool    = False,
):
    q = db.query(Alert)
    if unread:
        q = q.filter(Alert.read == False)
    alerts = q.order_by(Alert.created_at.desc()).all()
    return [
        {
            'id':        a.id,
            'title':     a.title,
            'message':   a.message,
            'severity':  a.severity,
            'read':      a.read,
            'report_id': a.report_id,
        }
        for a in alerts
    ]

@app.patch('/alerts/{alert_id}/read')
def mark_read(alert_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, 'Alerte introuvable')
    alert.read = True
    db.commit()
    return {'ok': True}

@app.patch('/alerts/read-all')
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Alert).filter(Alert.read == False).update({'read': True})
    db.commit()
    return {'ok': True}

# ── Health check ─────────────────────────────────────────────────────────────

@app.get('/health')
def health():
    return {
        'status':  'ok',
        'service': "SEN'EAU BI Platform API",
        'version': '1.0.0',
        'time':    datetime.now(timezone.utc).isoformat(),
    }

@app.get('/')
def root():
    return {'message': "SEN'EAU BI Platform API — Phase 1"}
