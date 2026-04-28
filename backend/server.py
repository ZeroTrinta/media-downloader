#!/usr/bin/env python3
"""
Media Downloader — Servidor local
Suporta: YouTube, Instagram, X (Twitter)
Uso: python server.py  →  http://localhost:8765
"""

import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

DOWNLOAD_DIR = Path.home() / "Downloads" / "media-downloader"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

PORT = 8765


def check_yt_dlp():
    try:
        r = subprocess.run(["yt-dlp", "--version"], capture_output=True, check=True, text=True)
        return r.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def check_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


update_status: dict = {"running": False, "log": [], "done": False, "error": None}


def run_update():
    update_status.update({"running": True, "log": [], "done": False, "error": None})
    try:
        proc = subprocess.Popen(
            ["pip", "install", "--upgrade", "yt-dlp"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
        )
        for line in proc.stdout:
            update_status["log"].append(line.strip())
        proc.wait()
        if proc.returncode == 0:
            update_status["done"] = True
        else:
            update_status["error"] = "Falha ao atualizar. Veja o log."
    except Exception as e:
        update_status["error"] = str(e)
    finally:
        update_status["running"] = False


def detect_platform(url: str) -> str:
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    if "instagram.com" in url:
        return "instagram"
    if "twitter.com" in url or "x.com" in url:
        return "x"
    return "generic"


def cookie_flags(browser: str) -> list:
    """Return yt-dlp cookie flags for a given browser name, or empty list."""
    if not browser or browser == "none":
        return []
    return ["--cookies-from-browser", browser]


def get_video_info(url: str, browser: str = "none") -> dict:
    cmd = ["yt-dlp", "--dump-json", "--no-playlist"] + cookie_flags(browser) + [url]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return {
                "title": data.get("title", "Sem título"),
                "duration": data.get("duration_string", ""),
                "uploader": data.get("uploader") or data.get("channel", ""),
                "thumbnail": data.get("thumbnail", ""),
            }
        # Return last meaningful error line
        err_lines = [l for l in result.stderr.strip().split("\n") if l.strip()]
        return {"error": err_lines[-1] if err_lines else "Erro desconhecido"}
    except Exception as e:
        return {"error": str(e)}


active_downloads: dict = {}


def build_command(url: str, mode: str, quality: str, output_template: str, platform: str, browser: str) -> list:
    """Build yt-dlp command tailored per platform, mode and cookies."""
    cookies = cookie_flags(browser)
    base = ["yt-dlp", "--no-playlist"] + cookies + ["-o", output_template]

    if platform in ("instagram", "x"):
        if mode == "audio":
            return base + ["-x", "--audio-format", "mp3", "--audio-quality", "0", url]
        return base + ["-f", "best[ext=mp4]/best", "--merge-output-format", "mp4", url]

    if mode == "audio":
        return base + ["-x", "--audio-format", "mp3", "--audio-quality", "0", url]

    fmt_map = {
        "best": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "720":  "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]",
        "480":  "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]",
    }
    fmt = fmt_map.get(quality, fmt_map["best"])
    return base + ["-f", fmt, "--merge-output-format", "mp4", url]


def download_media(download_id: str, url: str, mode: str, quality: str, browser: str = "none"):
    platform = detect_platform(url)
    output_template = str(DOWNLOAD_DIR / "%(uploader)s - %(title)s.%(ext)s")
    cmd = build_command(url, mode, quality, output_template, platform, browser)

    active_downloads[download_id] = {"status": "downloading", "progress": 0, "log": [], "platform": platform}

    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1
        )
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
            active_downloads[download_id]["log"].append(line)
            if "[download]" in line and "%" in line:
                try:
                    pct = float(line.split("%")[0].split()[-1])
                    active_downloads[download_id]["progress"] = round(pct)
                except Exception:
                    pass
        process.wait()
        if process.returncode == 0:
            active_downloads[download_id].update({"status": "done", "progress": 100, "folder": str(DOWNLOAD_DIR)})
        else:
            active_downloads[download_id]["status"] = "error"
    except Exception as e:
        active_downloads[download_id]["status"] = "error"
        active_downloads[download_id]["log"].append(str(e))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, html: str):
        body = html.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path in ("/favicon.ico", "/robots.txt"):
            self.send_response(204)
            self.end_headers()
            return

        if path in ("/", "/index.html"):
            html_path = Path(__file__).parent / "index.html"
            if html_path.exists():
                self.send_html(html_path.read_text(encoding="utf-8"))
            else:
                self.send_json({"error": "index.html não encontrado"}, 404)

        elif path == "/api/status":
            ver = check_yt_dlp()
            self.send_json({
                "yt_dlp": bool(ver),
                "yt_dlp_version": ver or "",
                "ffmpeg": check_ffmpeg(),
                "download_dir": str(DOWNLOAD_DIR),
            })

        elif path == "/api/info":
            url = params.get("url", [""])[0]
            browser = params.get("browser", ["none"])[0]
            if not url:
                self.send_json({"error": "URL não fornecida"}, 400)
            else:
                self.send_json(get_video_info(url, browser))

        elif path == "/api/update-status":
            self.send_json(update_status)

        elif path == "/api/progress":
            did = params.get("id", [""])[0]
            if did in active_downloads:
                self.send_json(active_downloads[did])
            else:
                self.send_json({"error": "ID não encontrado"}, 404)

        else:
            self.send_json({"error": "Rota não encontrada"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            data = json.loads(body)
        except Exception:
            self.send_json({"error": "JSON inválido"}, 400)
            return

        if parsed.path == "/api/download":
            url = data.get("url", "").strip()
            mode = data.get("mode", "video")
            quality = data.get("quality", "best")
            browser = data.get("browser", "none")
            if not url:
                self.send_json({"error": "URL não fornecida"}, 400)
                return
            import time, random
            did = f"{int(time.time())}-{random.randint(1000, 9999)}"
            threading.Thread(target=download_media, args=(did, url, mode, quality, browser), daemon=True).start()
            self.send_json({"id": did, "status": "started"})

        elif parsed.path == "/api/update":
            if update_status["running"]:
                self.send_json({"error": "Atualização já em andamento"})
            else:
                threading.Thread(target=run_update, daemon=True).start()
                self.send_json({"status": "started"})

        else:
            self.send_json({"error": "Rota não encontrada"}, 404)


def main():
    print("=" * 52)
    print("  Media Downloader — Servidor Local")
    print("  YouTube · Instagram · X (Twitter)")
    print("=" * 52)

    missing = []
    if not check_yt_dlp():
        missing.append(("yt-dlp", "pip install yt-dlp"))
    if not check_ffmpeg():
        missing.append(("ffmpeg", "brew install ffmpeg  (macOS) / sudo apt install ffmpeg  (Linux)"))

    if missing:
        print("\n[AVISO] Dependências faltando:")
        for name, cmd in missing:
            print(f"  {name}: {cmd}")

    print(f"\nPasta de downloads : {DOWNLOAD_DIR}")
    print(f"Servidor em        : http://localhost:{PORT}")
    print("Pressione Ctrl+C para encerrar.\n")

    server = HTTPServer(("localhost", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")


if __name__ == "__main__":
    main()
