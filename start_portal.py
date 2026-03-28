"""
SEN'EAU BI Portal — Démarrage rapide (sans Docker)
Lance le frontend Next.js en mode développement.
Le Dash dashboard doit tourner séparément sur :8050
"""
import subprocess
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent
FRONT = ROOT / 'frontend'

def check_node():
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        print(f'✅ Node.js : {result.stdout.strip()}')
        return True
    except FileNotFoundError:
        print('❌ Node.js non trouvé. Installez-le depuis https://nodejs.org/')
        return False

def install_deps():
    if not (FRONT / 'node_modules').exists():
        print('📦 Installation des dépendances npm…')
        subprocess.run(['npm', 'install'], cwd=FRONT, check=True, shell=True)
        print('✅ Dépendances installées.')
    else:
        print('✅ node_modules déjà présent.')

def start_frontend():
    print('\n🚀 Démarrage du portail SEN\'EAU BI Platform…')
    print('   URL : http://localhost:3000')
    print('   Dashboard Dash requis sur : http://localhost:8050')
    print('   Appuyez sur Ctrl+C pour arrêter.\n')
    subprocess.run(['npm', 'run', 'dev'], cwd=FRONT, shell=True)

if __name__ == '__main__':
    if not check_node():
        sys.exit(1)
    install_deps()
    start_frontend()
