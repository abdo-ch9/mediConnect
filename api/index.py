from app import app

# Vercel Python runtime entry point.
# The Flask WSGI application object (`app`) is imported and served by the
# @vercel/python build (see vercel.json). Serverless functions have a
# read-only filesystem, so the SQLite database and uploads are kept in /tmp
# (configured in app.py) — see the report for the production DB limitation.
