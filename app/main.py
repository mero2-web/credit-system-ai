from datetime import datetime, timedelta
from typing import List, Optional

import json
import io
import pandas as pd
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pathlib import Path

from app import models, schemas
from app.database import SessionLocal, engine
from app.logic import process_customer_row

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Credit System API")

# CORS
app.add_middleware(
	CORSMiddleware,
	allow_origins=[
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3001",
	],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# Auth settings
SECRET_KEY = "replace-this-with-a-strong-random-secret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
	return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
	return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
	to_encode = data.copy()
	expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
	to_encode.update({"exp": expire})
	return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def _policy_decision_from_dsr(dsr: float) -> str:
	if dsr > 0.60:
		return "Rejected"
	if dsr <= 0.45:
		return "Accepted"
	return "Review"


# 1) Authentication
@app.post("/auth/register", response_model=schemas.Token)
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
	existing = db.query(models.User).filter(models.User.username == payload.username).first()
	if existing:
		raise HTTPException(status_code=400, detail="Username already taken")
	user = models.User(
		username=payload.username,
		hashed_password=get_password_hash(payload.password),
	)
	db.add(user)
	db.commit()
	db.refresh(user)
	token = create_access_token({"sub": user.username})
	return {"access_token": token, "token_type": "bearer"}


@app.post("/auth/login", response_model=schemas.Token)
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
	user = db.query(models.User).filter(models.User.username == form_data.username).first()
	if not user or not verify_password(form_data.password, user.hashed_password):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
	token = create_access_token({"sub": user.username})
	return {"access_token": token, "token_type": "bearer"}


# 2) Customers - simple list for compatibility
@app.get("/customers", response_model=List[schemas.CustomerOut])
def get_customers(db: Session = Depends(get_db)):
	return db.query(models.Customer).all()


@app.get("/customers/statistics")
def get_decision_statistics(db: Session = Depends(get_db)):
	customers = db.query(models.Customer).all()
	if not customers:
		return {"message": "No customers found", "total_customers": 0, "statistics": {}}

	decisions = [c.decision for c in customers if c.decision]
	dsrs = [c.dsr for c in customers if c.dsr is not None]

	if not decisions:
		return {"message": "No processed decisions found", "total_customers": len(customers), "statistics": {}}

	decision_df = pd.Series(decisions)
	decision_counts = decision_df.value_counts()
	decision_percentages = (decision_df.value_counts(normalize=True) * 100).round(2)

	avg_dsr = sum(dsrs) / len(dsrs) if dsrs else 0
	high_risk_count = len([d for d in dsrs if d > 0.60]) if dsrs else 0

	statistics = {
		"total_customers": len(customers),
		"processed_customers": len(decisions),
		"decision_summary": {
			"counts": {
				"accepted": int(decision_counts.get('Accepted', 0)),
				"review": int(decision_counts.get('Review', 0)),
				"rejected": int(decision_counts.get('Rejected', 0)),
			},
			"percentages": {
				"accepted": float(decision_percentages.get('Accepted', 0)),
				"review": float(decision_percentages.get('Review', 0)),
				"rejected": float(decision_percentages.get('Rejected', 0)),
			},
		},
		"risk_analysis": {
			"average_dsr": round(avg_dsr, 4),
			"high_risk_customers": high_risk_count,
			"high_risk_percentage": round((high_risk_count / len(dsrs) * 100), 2) if dsrs else 0,
		},
	}
	return statistics


@app.get("/customers/detailed")
def get_customers_detailed(db: Session = Depends(get_db)):
	customers = db.query(models.Customer).all()
	if not customers:
		return {"message": "No customers found"}

	detailed_data = []
	for customer in customers:
		customer_data = {
			"id": customer.id,
			"customer_id": customer.customer_id,
			"personal_info": {
				"name": customer.name,
				"gender": customer.gender,
				"age": customer.age,
				"job_type": customer.job_type,
				"credit_history": customer.credit_history,
			},
			"financial_info": {
				"income": f"${customer.income:,.2f}",
				"expenses": f"${customer.expenses:,.2f}",
				"existing_loans": f"${customer.existing_loans:,.2f}",
			},
			"loan_details": {
				"financing_type": customer.financing_type,
				"asset_type": customer.asset_type,
				"asset_value": f"${customer.asset_value:,.2f}",
				"down_payment": f"${customer.down_payment:,.2f}",
				"installment_period": f"{customer.installment_period} months",
				"monthly_installment": f"${customer.monthly_installment:,.2f}" if customer.monthly_installment is not None else "N/A",
				"total_cost": f"${customer.total_cost:,.2f}" if customer.total_cost is not None else "N/A",
			},
			"decision_info": {
				"dsr": f"{customer.dsr:.4f} ({customer.dsr*100:.2f}%)" if customer.dsr is not None else "N/A",
				"decision": customer.decision or "Not Processed",
				"explanation": customer.explanation or "N/A",
				"suggestions": customer.suggestions or "None",
			},
		}
		detailed_data.append(customer_data)

	return {"customers": detailed_data, "total_count": len(detailed_data)}


@app.get("/customers/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
	customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
	if customer is None:
		raise HTTPException(status_code=404, detail="Customer not found")
	return customer


# Customer Applications (table-friendly endpoint; 15 per page)
@app.get("/customer-applications", response_model=schemas.CustomerApplicationsResponse)
def customer_applications(
	search: Optional[str] = None,
	decision: Optional[str] = None,
	page: int = 1,
	page_size: int = 15,
	db: Session = Depends(get_db),
):
	q = db.query(models.Customer)

	if search:
		q = q.filter(
			(models.Customer.customer_id.contains(search)) |
			(models.Customer.name.contains(search))
		)

	if decision:
		q = q.filter(
			(models.Customer.manual_decision == decision)
			| ((models.Customer.manual_decision == None) & (models.Customer.ml_final_decision == decision))
			| ((models.Customer.manual_decision == None) & (models.Customer.ml_final_decision == None) & (models.Customer.decision == decision))
		)

	total = q.count()
	items = (
		q.order_by(models.Customer.id.desc())
		 .offset((page - 1) * page_size)
		 .limit(page_size)
		 .all()
	)

	rows: List[schemas.CustomerApplicationRow] = []
	for c in items:
		# Prefer manual; otherwise policy from current DSR; then ML; then rule
		policy_final = _policy_decision_from_dsr(float(c.dsr or 0.0))
		final_display = c.manual_decision or policy_final or c.ml_final_decision or c.decision
		rows.append(
			schemas.CustomerApplicationRow(
				id=c.id,
				customer_id=c.customer_id,
				name=c.name,
				gender=c.gender,
				age=c.age,
				job_type=c.job_type,
				income=c.income,
				expenses=c.expenses,
				credit_history=c.credit_history,
				existing_loans=c.existing_loans,
				financing_type=c.financing_type,
				asset_type=c.asset_type,
				asset_value=c.asset_value,
				down_payment=c.down_payment,
				installment_period=c.installment_period,
				monthly_installment=c.monthly_installment,
				total_cost=c.total_cost,
				dsr=c.dsr,
				ai_decision=final_display,
				ml_p_accept=c.ml_p_accept,
				ml_label=c.ml_label,
				ml_confidence=c.ml_confidence,
				ml_confidence_band=c.ml_confidence_band,
				ml_final_decision=c.ml_final_decision,
				ml_updated_at=c.ml_updated_at,
				manual_decision=c.manual_decision,
				manual_note=c.manual_note,
				created_at=c.created_at,
				updated_at=c.ml_updated_at or c.created_at,
			)
		)

	return {"page": page, "page_size": page_size, "total": total, "results": rows}


# Also allow edit/delete by string customer_id (keep numeric-id routes intact)
@app.put("/customers/by-customer-id/{customer_id}", response_model=schemas.CustomerOut)
def update_customer_by_customer_id(customer_id: str, payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
	db_customer = db.query(models.Customer).filter(models.Customer.customer_id == customer_id).first()
	if db_customer is None:
		raise HTTPException(status_code=404, detail="Customer not found")

	processed = process_customer_row(payload.dict())

	if processed["customer_id"] != db_customer.customer_id:
		exists = db.query(models.Customer).filter(models.Customer.customer_id == processed["customer_id"]).first()
		if exists:
			raise HTTPException(status_code=409, detail="customer_id already exists")

	for key, value in processed.items():
		setattr(db_customer, key, value)

	try:
		db.commit()
	except IntegrityError:
		db.rollback()
		raise HTTPException(status_code=409, detail="customer_id already exists")

	db.refresh(db_customer)
	return db_customer


@app.delete("/customers/by-customer-id/{customer_id}", response_model=dict)
def delete_customer_by_customer_id(customer_id: str, db: Session = Depends(get_db)):
	db_customer = db.query(models.Customer).filter(models.Customer.customer_id == customer_id).first()
	if db_customer is None:
		raise HTTPException(status_code=404, detail="Customer not found")
	db.delete(db_customer)
	db.commit()
	return {"detail": "Customer deleted"}


# 2) Customers - write routes with uniqueness handling
@app.post("/customers", response_model=schemas.CustomerOut, status_code=201)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
	processed = process_customer_row(customer.dict())

	exists = db.query(models.Customer).filter(
		models.Customer.customer_id == processed["customer_id"]
	).first()
	if exists:
		raise HTTPException(status_code=409, detail="customer_id already exists")

	db_customer = models.Customer(**processed)
	db.add(db_customer)
	try:
		db.commit()
	except IntegrityError:
		db.rollback()
		raise HTTPException(status_code=409, detail="customer_id already exists")
	db.refresh(db_customer)
	return db_customer


@app.put("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
	db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
	if db_customer is None:
		raise HTTPException(status_code=404, detail="Customer not found")

	payload = customer.dict()
	processed = process_customer_row(payload)

	if processed["customer_id"] != db_customer.customer_id:
		exists = db.query(models.Customer).filter(
			models.Customer.customer_id == processed["customer_id"]
		).first()
		if exists:
			raise HTTPException(status_code=409, detail="customer_id already exists")

	for key, value in processed.items():
		setattr(db_customer, key, value)

	try:
		db.commit()
	except IntegrityError:
		db.rollback()
		raise HTTPException(status_code=409, detail="customer_id already exists")

	db.refresh(db_customer)
	return db_customer


@app.delete("/customers/{customer_id}", response_model=dict)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
	db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
	if db_customer is None:
		raise HTTPException(status_code=404, detail="Customer not found")
	db.delete(db_customer)
	db.commit()
	return {"detail": "Customer deleted"}


# 3) Rule-based AI Prediction (no DB write)
@app.post("/predict", response_model=schemas.PredictionResponse)
def predict(customer: schemas.CustomerCreate):
	processed = process_customer_row(customer.dict())
	return schemas.PredictionResponse(
		customer_id=processed["customer_id"],
		decision=processed["decision"],
		dsr=processed["dsr"],
		monthly_installment=processed["monthly_installment"],
		total_cost=processed["total_cost"],
		installment_period=processed["installment_period"],
		explanation=processed["explanation"],
		suggestions=processed["suggestions"],
	)


# 4) H2O binomial model (Accepted vs Rejected) with SHAP contributions
_H2O_BIN = None
_H2O_BIN_MODEL = None
_H2O_BIN_META = None
_H2O_BIN_FEATURES = None


def _load_h2o_bin():
	global _H2O_BIN, _H2O_BIN_MODEL, _H2O_BIN_META, _H2O_BIN_FEATURES
	if _H2O_BIN_MODEL is not None:
		return
	try:
		import h2o
		from h2o.frame import H2OFrame  # noqa: F401
		_H2O_BIN = h2o
	except Exception as e:
		raise HTTPException(status_code=503, detail=f"H2O not available: {e}")

	artifacts = Path(__file__).resolve().parent / "h2o" / "artifacts_bin"
	model_path_txt = artifacts / "model_path.txt"
	meta_path = artifacts / "metadata.json"
	if not model_path_txt.exists() or not meta_path.exists():
		raise HTTPException(status_code=503, detail="H2O model artifacts not found. Train it: python -m app.h2o.train_h2o_mc")

	model_path = model_path_txt.read_text(encoding="utf-8").strip()
	_H2O_BIN.init(max_mem_size="2G")
	_H2O_BIN_MODEL = _H2O_BIN.load_model(model_path)
	_H2O_BIN_META = json.loads(meta_path.read_text(encoding="utf-8"))
	_H2O_BIN_FEATURES = _H2O_BIN_META["features"]


def _band_from_confidence(conf: float) -> str:
	if conf >= 0.70:
		return "High"
	if conf >= 0.40:
		return "Medium"
	return "Low"


def _predict_h2o_from_payload(payload: dict) -> schemas.H2OBinaryPredictionResponse:
	processed = process_customer_row(payload)
	rule_decision = processed["decision"]
	dsr = float(processed["dsr"])
	monthly_installment = float(processed["monthly_installment"])
	total_cost = float(processed["total_cost"])
	months = int(processed["installment_period"])

	_load_h2o_bin()
	import pandas as pd
	from h2o.frame import H2OFrame

	row = {k: processed[k] for k in _H2O_BIN_FEATURES}
	for c in _H2O_BIN_META.get("categorical", []):
		row[c] = str(row[c])

	X = pd.DataFrame([row])
	hf = H2OFrame(X)
	for c in _H2O_BIN_META.get("categorical", []):
		hf[c] = hf[c].asfactor()

	pred_df = _H2O_BIN_MODEL.predict(hf).as_data_frame()
	pred_row = pred_df.iloc[0]

	domain = _H2O_BIN_MODEL._model_json["output"]["domains"][-1] or []
	if "Accepted" in domain:
		idx = domain.index("Accepted")
	else:
		idx = 1 if "p1" in pred_df.columns else 0
	p_col = f"p{idx}" if f"p{idx}" in pred_df.columns else None
	if p_col:
		p_accept = float(pred_row[p_col])
	else:
		pred_label = str(pred_row.get("predict", "Rejected"))
		p_accept = 0.51 if pred_label == "Accepted" else 0.49

	h2o_label = "Accepted" if p_accept >= 0.5 else "Rejected"
	confidence = max(p_accept, 1.0 - p_accept)
	confidence_band = _band_from_confidence(confidence)

	# Policy-first finalization (AI advisory only)
	policy_final = _policy_decision_from_dsr(dsr)
	explanations = [
		f"Rule decision: {rule_decision} (DSR={dsr:.4f} or {dsr*100:.2f}%).",
		f"H2O (binomial): P(Accept)={p_accept:.4f}; confidence={confidence:.2f} ({confidence_band}); label={h2o_label}.",
		f"Final decision by policy: {policy_final}. If Review, employee must set a manual decision."
	]
	final_decision = policy_final

	# Try SHAP (top 5 pos/neg)
	try:
		contrib_df = _H2O_BIN_MODEL.predict_contributions(hf).as_data_frame()
		shap = contrib_df.iloc[0].to_dict()
		shap.pop("BiasTerm", None)
		shap_contribs = {k: float(v) for k, v in shap.items()}
		sorted_feats = sorted(shap_contribs.items(), key=lambda kv: abs(kv[1]), reverse=True)
		shap_top_positive = [f"{k}: {v:+.4f}" for k, v in sorted_feats if v > 0][:5]
		shap_top_negative = [f"{k}: {v:+.4f}" for k, v in sorted_feats if v < 0][:5]
	except Exception:
		shap_contribs = {}
		shap_top_positive = []
		shap_top_negative = []

	return schemas.H2OBinaryPredictionResponse(
		rule_decision=rule_decision,
		dsr=dsr,
		monthly_installment=monthly_installment,
		total_cost=total_cost,
		installment_period=months,
		h2o_predicted_label=h2o_label,
		p_accept=p_accept,
		confidence=confidence,
		confidence_band=confidence_band,
		final_decision=final_decision,
		policy_explanations=explanations,
		shap_contributions=shap_contribs,
		shap_top_positive=shap_top_positive,
		shap_top_negative=shap_top_negative,
	)


@app.post("/predict-h2o", response_model=schemas.H2OBinaryPredictionResponse)
def predict_h2o(customer: schemas.CustomerCreate):
	return _predict_h2o_from_payload(customer.dict())


# Helpers for DB-backed predictions
def _db_customer_to_payload(c: models.Customer) -> dict:
	return {
		"customer_id": c.customer_id,
		"name": c.name,
		"gender": c.gender,
		"age": c.age,
		"job_type": c.job_type,
		"income": float(c.income),
		"expenses": float(c.expenses),
		"credit_history": c.credit_history,
		"existing_loans": float(c.existing_loans),
		"financing_type": c.financing_type,
		"asset_type": c.asset_type,
		"asset_value": float(c.asset_value),
		"down_payment": float(c.down_payment),
		"installment_period": int(c.installment_period or 36),
	}


# Predict by customer_id (string) using DB record
@app.post("/predict-h2o/by-customer-id", response_model=schemas.H2OBinaryPredictionResponse)
def predict_h2o_by_customer_id(req: schemas.PredictByCustomerIdRequest, db: Session = Depends(get_db)):
	customer = db.query(models.Customer).filter(models.Customer.customer_id == req.customer_id).first()
	if customer is None:
		raise HTTPException(status_code=404, detail="Customer not found")
	payload = _db_customer_to_payload(customer)
	return _predict_h2o_from_payload(payload)


# Batch predictions (all customers or a list of customer_ids)
@app.post("/predict-h2o/batch", response_model=schemas.H2OBinaryBatchResponse)
def predict_h2o_batch(req: schemas.PredictBatchRequest, db: Session = Depends(get_db)):
	if req.all:
		customers = db.query(models.Customer).all()
	else:
		if not req.customer_ids:
			raise HTTPException(status_code=400, detail="Provide customer_ids or set all=true")
		customers = db.query(models.Customer).filter(models.Customer.customer_id.in_(req.customer_ids)).all()
	if not customers:
		return {"count": 0, "results": []}

	results = []
	for c in customers:
		payload = _db_customer_to_payload(c)
		res = _predict_h2o_from_payload(payload)
		results.append({
			"id": c.id,
			"customer_id": c.customer_id,
			"h2o_predicted_label": res.h2o_predicted_label,
			"p_accept": res.p_accept,
			"confidence": res.confidence,
			"confidence_band": res.confidence_band,
			"rule_decision": res.rule_decision,
			"final_decision": res.final_decision,
			"dsr": res.dsr,
			"monthly_installment": res.monthly_installment,
			"total_cost": res.total_cost,
			"installment_period": res.installment_period,
		})

	return {"count": len(results), "results": results}


# Warm H2O on startup (optional)
@app.on_event("startup")
def _startup_warm_h2o():
	try:
		_load_h2o_bin()
	except Exception:
		pass


def _score_h2o_vectorized(rows: List[dict]):
	"""Score multiple processed rows using a single H2O predict call."""
	_load_h2o_bin()
	import pandas as pd
	from h2o.frame import H2OFrame

	if not rows:
		return []

	frame_rows = []
	for processed in rows:
		row = {k: processed[k] for k in _H2O_BIN_FEATURES}
		for c in _H2O_BIN_META.get("categorical", []):
			row[c] = str(row[c])
		frame_rows.append(row)

	X = pd.DataFrame(frame_rows)
	hf = H2OFrame(X)
	for c in _H2O_BIN_META.get("categorical", []):
		hf[c] = hf[c].asfactor()

	pred = _H2O_BIN_MODEL.predict(hf).as_data_frame()
	try:
		contrib = _H2O_BIN_MODEL.predict_contributions(hf).as_data_frame()
	except Exception:
		contrib = None

	domain = _H2O_BIN_MODEL._model_json["output"]["domains"][-1] or []
	if "Accepted" in domain:
		idx = domain.index("Accepted")
	else:
		idx = 1 if "p1" in pred.columns else 0
	p_col = f"p{idx}" if f"p{idx}" in pred.columns else None

	results = []
	for i in range(len(rows)):
		if p_col:
			p_accept = float(pred.iloc[i][p_col])
		else:
			pred_label = str(pred.iloc[i].get("predict", "Rejected"))
			p_accept = 0.51 if pred_label == "Accepted" else 0.49
		label = "Accepted" if p_accept >= 0.5 else "Rejected"
		confidence = max(p_accept, 1.0 - p_accept)
		band = _band_from_confidence(confidence)
		shap_map = {}
		if contrib is not None:
			rowc = contrib.iloc[i].to_dict()
			rowc.pop("BiasTerm", None)
			shap_map = {k: float(v) for k, v in rowc.items()}
		results.append({
			"p_accept": p_accept,
			"label": label,
			"confidence": confidence,
			"confidence_band": band,
			"shap": shap_map,
		})
	return results


# Customer detail enriched + SHAP
@app.get("/customers/{id}/detail", response_model=schemas.CustomerDetailResponse)
def customer_detail(id: int, db: Session = Depends(get_db)):
	c = db.query(models.Customer).filter(models.Customer.id == id).first()
	if not c:
		raise HTTPException(status_code=404, detail="Customer not found")
	base = schemas.CustomerOut.from_orm(c)

	# Prefer manual; otherwise policy from current DSR; then ML; then rule
	policy_final = _policy_decision_from_dsr(float(c.dsr or 0.0))
	final_display = c.manual_decision or policy_final or c.ml_final_decision or c.decision
	setattr(base, "final_display_decision", final_display)

	try:
		res = _predict_h2o_from_payload(_db_customer_to_payload(c))
		return {
			"base": base,
			"shap_contributions": res.shap_contributions,
			"shap_top_positive": res.shap_top_positive,
			"shap_top_negative": res.shap_top_negative,
		}
	except Exception:
		return {"base": base, "shap_contributions": None, "shap_top_positive": None, "shap_top_negative": None}


# Manual decision override
@app.patch("/customers/{id}/decision")
def set_manual_decision(id: int, body: schemas.ManualDecisionRequest, db: Session = Depends(get_db)):
	c = db.query(models.Customer).filter(models.Customer.id == id).first()
	if not c:
		raise HTTPException(status_code=404, detail="Customer not found")
	if body.decision not in {"Accepted", "Review", "Rejected"}:
		raise HTTPException(status_code=400, detail="decision must be Accepted|Review|Rejected")
	c.manual_decision = body.decision
	c.manual_note = body.note or None
	db.commit()
	return {"detail": "Manual decision updated"}


# Batch score and persist ML fields (policy-first finalization)
@app.post("/predict-h2o/score-batch")
def score_batch(req: schemas.ScoreBatchRequest, db: Session = Depends(get_db)):
	if req.all:
		customers = db.query(models.Customer).all()
	else:
		if not req.customer_ids:
			raise HTTPException(status_code=400, detail="Provide customer_ids or set all=true")
		customers = db.query(models.Customer).filter(models.Customer.customer_id.in_(req.customer_ids)).all()
	if not customers:
		return {"updated": 0}

	processed_rows = [process_customer_row(_db_customer_to_payload(c)) for c in customers]
	scored = _score_h2o_vectorized(processed_rows)
	updated = 0
	for c, p in zip(customers, scored):
		c.ml_p_accept = float(p["p_accept"]) if p else None
		c.ml_label = str(p["label"]) if p else None
		c.ml_confidence = float(p["confidence"]) if p else None
		c.ml_confidence_band = str(p["confidence_band"]) if p else None
		# Policy-first finalization
		dsr = float(c.dsr) if c.dsr is not None else float(processed_rows[updated]["dsr"])
		c.ml_final_decision = _policy_decision_from_dsr(dsr)
		c.ml_updated_at = datetime.utcnow()
		updated += 1
	db.commit()
	return {"updated": updated}


# CSV import (multipart file)
@app.post("/import-csv", response_model=schemas.ImportCSVResponse)
def import_csv(file: UploadFile = File(...), score_after: bool = True, db: Session = Depends(get_db)):
	if not file.filename.endswith(".csv"):
		raise HTTPException(status_code=400, detail="Only CSV files are supported")
	content = file.file.read()
	df = pd.read_csv(io.BytesIO(content))

	required = {"customer_id","name","gender","age","job_type","income","expenses","credit_history",
	            "existing_loans","financing_type","asset_type","asset_value","down_payment","installment_period"}
	missing = required - set(df.columns)
	if missing:
		raise HTTPException(status_code=400, detail=f"CSV missing columns: {sorted(missing)}")

	inserted = 0
	skipped = 0
	for _, row in df.iterrows():
		payload = {k: row[k] for k in required}
		processed = process_customer_row(payload)
		if db.query(models.Customer).filter(models.Customer.customer_id == processed["customer_id"]).first():
			skipped += 1
			continue
		c = models.Customer(**processed)
		db.add(c)
		inserted += 1
	db.commit()

	if score_after and inserted > 0:
		customers = db.query(models.Customer).filter(models.Customer.customer_id.in_(list(df["customer_id"].astype(str)))).all()
		processed_rows = [process_customer_row(_db_customer_to_payload(c)) for c in customers]
		scored = _score_h2o_vectorized(processed_rows)
		for c, p in zip(customers, scored):
			c.ml_p_accept = float(p["p_accept"]) if p else None
			c.ml_label = str(p["label"]) if p else None
			c.ml_confidence = float(p["confidence"]) if p else None
			c.ml_confidence_band = str(p["confidence_band"]) if p else None
			# Policy-first: use DSR to set final
			c.ml_final_decision = _policy_decision_from_dsr(float(c.dsr or 0.0))
			c.ml_updated_at = datetime.utcnow()
		db.commit()

	return {"inserted": inserted, "skipped": skipped}


# Read-only profile with all raw customer fields (by numeric id)
@app.get("/customers/{id}/profile", response_model=schemas.CustomerBase)
def get_customer_profile(id: int, db: Session = Depends(get_db)):
	c = db.query(models.Customer).filter(models.Customer.id == id).first()
	if not c:
		raise HTTPException(status_code=404, detail="Customer not found")
	return {
		"customer_id": c.customer_id,
		"name": c.name,
		"gender": c.gender,
		"age": c.age,
		"job_type": c.job_type,
		"income": c.income,
		"expenses": c.expenses,
		"credit_history": c.credit_history,
		"existing_loans": c.existing_loans,
		"financing_type": c.financing_type,
		"asset_type": c.asset_type,
		"asset_value": c.asset_value,
		"down_payment": c.down_payment,
		"installment_period": c.installment_period,
	}

@app.get("/customers/by-customer-id/{customer_id}/profile", response_model=schemas.CustomerBase)
def get_customer_profile_by_customer_id(customer_id: str, db: Session = Depends(get_db)):
	c = db.query(models.Customer).filter(models.Customer.customer_id == customer_id).first()
	if not c:
		raise HTTPException(status_code=404, detail="Customer not found")
	return {
		"customer_id": c.customer_id,
		"name": c.name,
		"gender": c.gender,
		"age": c.age,
		"job_type": c.job_type,
		"income": c.income,
		"expenses": c.expenses,
		"credit_history": c.credit_history,
		"existing_loans": c.existing_loans,
		"financing_type": c.financing_type,
		"asset_type": c.asset_type,
		"asset_value": c.asset_value,
		"down_payment": c.down_payment,
		"installment_period": c.installment_period,
	}


# Analytics overview
@app.get("/analytics/overview", response_model=schemas.AnalyticsOverviewResponse)
def analytics_overview(db: Session = Depends(get_db)):
	customers = db.query(models.Customer).all()
	if not customers:
		return {
			"total_customers": 0,
			"avg_dsr": 0.0,
			"decisions_breakdown": {},
			"gender_distribution": {},
			"financing_type_distribution": {},
			"dsr_histogram": {},
		}
	from collections import Counter
	decisions = [c.manual_decision or c.ml_final_decision or c.decision for c in customers if (c.manual_decision or c.ml_final_decision or c.decision)]
	genders = [c.gender for c in customers]
	fin_types = [c.financing_type for c in customers]
	dsrs = [c.dsr for c in customers if c.dsr is not None]
	avg_dsr = float(sum(dsrs) / len(dsrs)) if dsrs else 0.0
	bins = {"<0.45": 0, "0.45-0.60": 0, ">0.60": 0}
	for v in dsrs:
		if v < 0.45:
			bins["<0.45"] += 1
		elif v <= 0.60:
			bins["0.45-0.60"] += 1
		else:
			bins[">0.60"] += 1
	return {
		"total_customers": len(customers),
		"avg_dsr": round(avg_dsr, 4),
		"decisions_breakdown": dict(Counter(decisions)),
		"gender_distribution": dict(Counter(genders)),
		"financing_type_distribution": dict(Counter(fin_types)),
		"dsr_histogram": bins,
	}