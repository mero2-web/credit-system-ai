# Credit System

A full-stack application for managing customer credit applications, scoring, and analytics, designed specifically for Islamic finance institutions.  
Backend: FastAPI, SQLite, H2O ML.  
Frontend: React, Tailwind CSS.

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
credit_system.db
customers_dump.csv
app/
  __init__.py
  crud.py
  database.py
  import_csv.py
  logic.py
  main.py
  models.py
  schemas.py
  utils.py
  h2o/
    train_h2o_mc.py
    artifacts_bin/
loan-dashboard/
  src/
  public/
  package.json
  tailwind.config.js
  ...
```

## Backend (FastAPI)

- **Run:**  
  ```sh
  cd app
  uvicorn main:app --reload
  ```
- **API Docs:**  
  Visit [http://localhost:8000/docs](http://localhost:8000/docs)

- **Key files:**  
  - `main.py`: FastAPI entrypoint  
  - `models.py`: SQLAlchemy models  
  - `schemas.py`: Pydantic schemas  
  - `logic.py`: Business logic  
  - `h2o/train_h2o_mc.py`: ML model training

## Frontend (React)

- **Run:**  
  ```sh
  cd loan-dashboard
  npm install
  npm start
  ```
- **Key files:**  
  - `src/App.js`: Main dashboard  
  - `src/DataManagementPage.jsx`: Customer data management  
  - `src/CustomerDetail.jsx`: Customer detail view

## Environment

- Python 3.10+
- Node.js 18+
- SQLite (local file)
- H2O (Python package)

## Usage

1. Start backend (`uvicorn main:app --reload`)
2. Start frontend (`npm start`)
3. Access dashboard at [http://localhost:3000](http://localhost:3000)
4. Import customer data, view analytics, and manage applications

## License

MIT

---

For more details, see `loan
