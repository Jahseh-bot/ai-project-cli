"""Isolated PostgreSQL integration smoke; removes only its own container."""
import json
import os
import pathlib
import secrets
import subprocess
import time

root = pathlib.Path(__file__).resolve().parents[1]
project = root / '.artifacts/smoke/api-postgres'
name = 'ai-project-smoke-' + secrets.token_hex(5)
password = secrets.token_hex(24)
created = False
try:
    subprocess.run(['docker', 'run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=app', '-p', '127.0.0.1::5432', 'postgres:17'], check=True, stdout=subprocess.DEVNULL)
    created = True
    for _ in range(60):
        result = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise RuntimeError('PostgreSQL did not start')
    ports = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]['NetworkSettings']['Ports']['5432/tcp']
    port = ports[0]['HostPort']
    env = dict(os.environ, DATABASE_URL=f'postgresql://postgres:{password}@127.0.0.1:{port}/app')
    with open(root / '.artifacts/smoke/postgres-integration.log', 'w') as log:
        for command in [['npm', 'run', 'check'], ['npm', 'run', 'migrate'], ['npm', 'run', 'migrate']]:
            subprocess.run(command, cwd=project, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        count = subprocess.check_output(['docker', 'exec', name, 'psql', '-U', 'postgres', '-d', 'app', '-tAc', 'SELECT count(*) FROM schema_migrations']).decode().strip()
        assert count == '1', count
        migration = project / 'migrations/001_initial.sql'
        original = migration.read_text()
        try:
            migration.write_text(original + '\n-- modified\n')
            result = subprocess.run(['npm', 'run', 'migrate'], cwd=project, env=env, stdout=log, stderr=subprocess.STDOUT)
            assert result.returncode != 0, 'Changed migration must fail'
        finally:
            migration.write_text(original)
    print('PostgreSQL PASS: schema applied once, repeat safe, changed history rejected')
finally:
    if created:
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
