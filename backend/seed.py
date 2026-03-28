"""Peuple la base avec les données initiales (utilisateurs + rapports + alertes)."""
import json
import uuid
from database import engine, SessionLocal, Base
from models import User, Report, Alert
from auth import hash_password

def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ── Utilisateurs ──────────────────────────────────────────────────────
        if not db.query(User).first():
            users = [
                User(id='u1', name='Asta Niang',    email='a.niang@seneau.sn',
                     password=hash_password('admin2025'),    role='super_admin'),
                User(id='u2', name='Moussa Ndiaye', email='m.ndiaye@seneau.sn',
                     password=hash_password('analyste2025'), role='analyste', dt='DT Nord'),
                User(id='u3', name='Fatou Sarr',    email='f.sarr@seneau.sn',
                     password=hash_password('lecteur2025'),  role='lecteur_dt', dt='DT Sud'),
            ]
            db.add_all(users)

        # ── Rapports ─────────────────────────────────────────────────────────
        if not db.query(Report).first():
            reports = [
                Report(
                    id='facturation', title='Facturation & Recouvrement',
                    description='Suivi CA, encaissements, impayés et taux de recouvrement.',
                    category='facturation', url='http://localhost:8050', external=True,
                    owner='Direction Clientèle', status='live', pinned=True,
                    tags=json.dumps(['KPI', 'Recouvrement', 'Impayés']),
                    access_roles=json.dumps(['super_admin', 'admin_metier', 'analyste', 'lecteur_dt']),
                ),
                Report(
                    id='score360', title='Score Client 360°',
                    description='Segmentation ML des clients en 5 segments.',
                    category='facturation', url='http://localhost:8050/score360', external=True,
                    owner='DSI — Data Science', status='recent', pinned=True,
                    tags=json.dumps(['ML', 'Segmentation', 'Score']),
                    access_roles=json.dumps(['super_admin', 'admin_metier', 'analyste']),
                ),
                Report(
                    id='suivi-releveur', title='Suivi Releveurs',
                    description='Performance des équipes de relevé terrain.',
                    category='production', url='http://localhost:8050/releveur', external=True,
                    owner='Direction Technique', status='live', pinned=True,
                    tags=json.dumps(['Terrain', 'Tournée']),
                    access_roles=json.dumps(['super_admin', 'admin_metier', 'analyste', 'lecteur_dt', 'releveur']),
                ),
                Report(
                    id='carte-clients', title='Carte Clients',
                    description='Visualisation géospatiale des clients et impayés.',
                    category='sig', url='http://localhost:8050/carte', external=True,
                    owner='Direction Clientèle', status='recent', pinned=False,
                    tags=json.dumps(['Carte', 'Géographie']),
                    access_roles=json.dumps(['super_admin', 'admin_metier', 'analyste']),
                ),
            ]
            db.add_all(reports)

        # ── Alertes ───────────────────────────────────────────────────────────
        if not db.query(Alert).first():
            alerts = [
                Alert(id='a1', title='Taux recouvrement critique — DT Est',
                      message='Taux à 38.2%. Seuil 40% dépassé.', severity='critical',
                      read=False, report_id='facturation'),
                Alert(id='a2', title='Impayés en hausse — DT Nord',
                      message='+18.4% sur 7 jours.', severity='warning',
                      read=False, report_id='facturation'),
                Alert(id='a3', title='3 clients basculent en segment Critique',
                      message='Clients C-0042, C-0087, C-0134.', severity='warning',
                      read=False, report_id='score360'),
            ]
            db.add_all(alerts)

        db.commit()
        print('✅ Base de données initialisée avec succès.')
    finally:
        db.close()

if __name__ == '__main__':
    run()
