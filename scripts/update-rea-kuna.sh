#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO_DIR="$HOME/rea-kuna"
cd "$REPO_DIR"

echo "=== [1/5] Fetching upstream morluto/rea ==="
git fetch upstream

echo "=== [2/5] Merging upstream/main into local main ==="
git merge upstream/main -m "chore: sync upstream morluto/rea" || {
  echo "Merge conflict detected! Please resolve conflicts before building."
  exit 1
}

echo "=== [3/5] Pushing merged changes to your fork (origin/main) ==="
git push origin main

echo "=== [4/5] Offloading build to Google Colab High-RAM ==="
SESSION="rea-builder-$(date +%s)"
colab --auth=oauth2 new --high-mem -s "$SESSION"

# Run remote build script on Colab VM
python3 -c "
import subprocess, sys

build_script = '''
import subprocess
def run(cmd):
    print(f'>>> {cmd}', flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for l in iter(p.stdout.readline, ''): print(l, end='', flush=True)
    p.stdout.close()
    if p.wait() != 0: raise RuntimeError(f'Command failed: {cmd}')

run('rm -rf /content/rea-kuna && git clone --depth 1 https://github.com/nickarcade/rea-kuna.git /content/rea-kuna')
run('which node || (curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs)')
run('cd /content/rea-kuna && npm ci && npm run build:cached')
run('tar -czf /content/rea-build.tar.gz -C /content/rea-kuna dist skills')
'''

p = subprocess.Popen(['colab', '--auth=oauth2', 'exec', '-s', '$SESSION'], stdin=subprocess.PIPE, text=True)
p.communicate(input=build_script)
if p.returncode != 0:
    subprocess.run(['colab', '--auth=oauth2', 'stop', '-s', '$SESSION'])
    sys.exit(1)
"

echo "=== Downloading compiled artifacts from Colab ==="
colab --auth=oauth2 download /content/rea-build.tar.gz "$REPO_DIR/rea-build.tar.gz" -s "$SESSION"
colab --auth=oauth2 stop -s "$SESSION"

echo "=== [5/5] Extracting build and refreshing device environment ==="
tar -xzf "$REPO_DIR/rea-build.tar.gz" -C "$REPO_DIR"
rm -f "$REPO_DIR/rea-build.tar.gz"

npm install --omit=dev --ignore-scripts
termux-fix-shebang "$REPO_DIR/scripts/rea.mjs"

echo "=== Running doctor check ==="
rea doctor

echo "=== REA-Kuna update completed successfully! ==="
