# Credit System

A full-stack application for managing customer credit applications, scoring, and analytics, designed specifically for Islamic finance institutions.
Backend: FastAPI, SQLite, H2O ML. Frontend: React, Tailwind CSS.

## Description

This system is built to support Islamic finance credit assessment, ensuring all decisions and scoring are compliant with Shariah rules. Unlike conventional credit scoring platforms, this solution integrates rule-based logic and machine learning models tailored for Islamic financing products, such as Murabaha, Ijarah, and diminishing Musharakah. It avoids interest-based calculations and instead uses permissible profit rates and asset-backed financing structures.

**Key differences from conventional systems:**
- **Shariah Compliance:** All credit decisions are based on Islamic finance principles, avoiding riba (interest) and ensuring ethical asset-backed transactions.
- **Customizable Rules:** Rule engine supports Shariah-compliant logic for eligibility, DSR (Debt Service Ratio), and product types.
- **Explanations:** Each decision includes clear explanations and suggestions, referencing relevant Shariah guidelines.
- **Analytics:** Dashboard provides insights into customer distribution, decisions, and DSR, with breakdowns by gender and financing type.

## Features

- Customer CRUD operations
- CSV import/export
- Rule-based and ML-based credit scoring (Shariah-compliant)
- SHAP-like explanations for predictions
- Authentication (JWT)
- Analytics dashboard (DSR, decisions, distributions)
- Responsive React dashboard

## Project Structure

```
app/
  database.py
  import_csv.py
  logic.py
  main.py
  models.py
  schemas.py
  Procfile
  h2o/
    train_h2o_mc.py
    artifacts_bin/
loan-dashboard/
  src/
  public/
  package.json
  tailwind.config.js
requirements.txt
```

## Local development

### Backend

Run from the repo root (not from inside `app/`) since imports are `app.*`:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs at [http://localhost:8000/docs](http://localhost:8000/docs). Set `SECRET_KEY` in your environment before running anywhere other than your own machine.

### Frontend

```bash
cd loan-dashboard
npm install
npm start
```

Dashboard at [http://localhost:3000](http://localhost:3000). Set `REACT_APP_API_URL` if your backend isn't on `localhost:8000`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `SECRET_KEY` | backend | JWT signing secret — required in production |
| `ALLOWED_ORIGINS` | backend | Comma-separated extra CORS origins (e.g. your Netlify URL) |
| `REACT_APP_API_URL` | frontend build | Backend base URL |

## Deployment

- **Backend**: Render web service. `app/Procfile` runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend**: Netlify. Build command `npm run build`, publish directory `build`. SPA routing handled by `loan-dashboard/public/_redirects`.

## License

MIT
