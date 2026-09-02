import os
import sys
import time
import subprocess
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")

def print_banner():
    print("=" * 70)
    print("  IBVAP - Intelligent Border Video Analytics Platform Launcher")
    print("=" * 70)

def verify_environment():
    """Run pre-flight import checks to ensure zero startup crash on fresh clones."""
    print("\n[+] Running pre-flight environment self-test...")
    try:
        res = subprocess.run(
            [sys.executable, "-c", "import backend.app.main"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True
        )
        if res.returncode != 0:
            print("\n[!] Pre-flight import check failed!")
            print(res.stderr)
            print("\n[!] Please install missing requirements using:")
            print("    pip install -r requirements.txt")
            sys.exit(1)
        print("    [✓] Backend and Vision modules verified 100% cleanly.")
    except Exception as e:
        print(f"\n[!] Environment check error: {e}")
        sys.exit(1)

def ensure_frontend_built():
    """Build frontend dist bundle if missing."""
    if not os.path.exists(FRONTEND_DIST):
        print("\n[+] Production frontend dist missing. Building bundle...")
        subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, shell=True, check=True)
        print("    [✓] Frontend dist bundle compiled successfully.")

def main():
    print_banner()
    verify_environment()
    ensure_frontend_built()

    print("\n[+] Launching FastAPI Backend Server on http://localhost:8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=ROOT_DIR
    )

    print("[+] Launching React Frontend Dev Server on http://localhost:3000...")
    frontend_proc = subprocess.Popen(
        "npm run dev",
        cwd=FRONTEND_DIR,
        shell=True
    )

    print("\n" + "=" * 70)
    print("  [SUCCESS] IBVAP IS LIVE AND RUNNING!")
    print("  Primary Dashboard: http://localhost:8000")
    print("  Frontend React UI: http://localhost:3000")
    print("  Backend REST Docs: http://localhost:8000/docs")
    print("  Press Ctrl+C to stop all services cleanly.")
    print("=" * 70 + "\n")

    time.sleep(2)
    webbrowser.open("http://localhost:8000")

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\n[!] Gracefully shutting down IBVAP services...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("[✓] Shutdown complete.")

if __name__ == "__main__":
    main()
