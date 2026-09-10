.PHONY: seed test backend frontend

seed:
	cd backend && PYTHONPATH=. python seed_demo.py

test:
	cd backend && PYTHONPATH=. pytest -q

backend:
	cd backend && PYTHONPATH=. uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev
