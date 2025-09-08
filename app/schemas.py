from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, List
from datetime import datetime

# Customer schemas
class CustomerBase(BaseModel):
	customer_id: str
	name: str
	gender: str
	age: int
	job_type: str
	income: float
	expenses: float
	credit_history: str
	existing_loans: float
	financing_type: str
	asset_type: str
	asset_value: float
	down_payment: float
	installment_period: int  # required

class CustomerCreate(CustomerBase):
	pass

class CustomerOut(BaseModel):
	# Enable SQLAlchemy ORM serialization (Pydantic v2)
	model_config = ConfigDict(from_attributes=True)

	id: int
	monthly_installment: Optional[float] = None
	total_cost: Optional[float] = None
	dsr: Optional[float] = None
	decision: Optional[str] = None
	explanation: Optional[str] = None
	suggestions: Optional[str] = None

	# ML/Manual fields
	ml_p_accept: Optional[float] = None
	ml_label: Optional[str] = None
	ml_confidence: Optional[float] = None
	ml_confidence_band: Optional[str] = None
	ml_final_decision: Optional[str] = None
	ml_updated_at: Optional[datetime] = None
	manual_decision: Optional[str] = None
	manual_note: Optional[str] = None

	# Derived for UI
	final_display_decision: Optional[str] = None

	created_at: Optional[datetime] = None


# Applications table rows (all dataset fields + AI decision)
class CustomerApplicationRow(BaseModel):
	id: int
	customer_id: str
	name: Optional[str] = None
	gender: Optional[str] = None
	age: Optional[int] = None
	job_type: Optional[str] = None
	income: Optional[float] = None
	expenses: Optional[float] = None
	credit_history: Optional[str] = None
	existing_loans: Optional[float] = None
	financing_type: Optional[str] = None
	asset_type: Optional[str] = None
	asset_value: Optional[float] = None
	down_payment: Optional[float] = None
	installment_period: Optional[int] = None
	monthly_installment: Optional[float] = None
	total_cost: Optional[float] = None
	dsr: Optional[float] = None
	ai_decision: Optional[str] = None  # manual -> ml_final -> rule

	# ML
	ml_p_accept: Optional[float] = None
	ml_label: Optional[str] = None
	ml_confidence: Optional[float] = None
	ml_confidence_band: Optional[str] = None
	ml_final_decision: Optional[str] = None
	ml_updated_at: Optional[datetime] = None

	# Manual
	manual_decision: Optional[str] = None
	manual_note: Optional[str] = None

	# Timestamps
	created_at: Optional[datetime] = None
	updated_at: Optional[datetime] = None

class CustomerApplicationsResponse(BaseModel):
	page: int
	page_size: int
	total: int
	results: List[CustomerApplicationRow]


# Detail view
class CustomerDetailResponse(BaseModel):
	base: CustomerOut
	shap_contributions: Optional[Dict[str, float]] = None
	shap_top_positive: Optional[List[str]] = None
	shap_top_negative: Optional[List[str]] = None


# Auth schemas
class UserCreate(BaseModel):
	username: str
	password: str

class UserLogin(BaseModel):
	username: str
	password: str

class Token(BaseModel):
	access_token: str
	token_type: str = "bearer"


# Rule-based prediction schema
class PredictionResponse(BaseModel):
	customer_id: str
	decision: str
	dsr: float
	monthly_installment: float
	total_cost: float
	installment_period: int
	explanation: str
	suggestions: str


# H2O binomial prediction schema (with SHAP-like explanations)
class H2OBinaryPredictionResponse(BaseModel):
	# Rule-based
	rule_decision: str
	dsr: float
	monthly_installment: float
	total_cost: float
	installment_period: int

	# H2O binomial
	h2o_predicted_label: str
	p_accept: float
	confidence: float
	confidence_band: str  # High/Medium/Low

	# Final
	final_decision: str
	policy_explanations: List[str]

	# SHAP-like
	shap_contributions: Dict[str, float]
	shap_top_positive: List[str]
	shap_top_negative: List[str]


# New: requests/responses for by-customer and batch predictions
class PredictByCustomerIdRequest(BaseModel):
	customer_id: str

class PredictBatchRequest(BaseModel):
	customer_ids: Optional[List[str]] = None
	all: bool = False

class H2OBinaryPredictionRow(BaseModel):
	id: int
	customer_id: str
	h2o_predicted_label: str
	p_accept: float
	confidence: float
	confidence_band: str
	rule_decision: str
	final_decision: str
	dsr: float
	monthly_installment: float
	total_cost: float
	installment_period: int

class H2OBinaryBatchResponse(BaseModel):
	count: int
	results: List[H2OBinaryPredictionRow]


# Requests for CSV import and scoring
class ImportCSVResponse(BaseModel):
	inserted: int
	skipped: int
	message: Optional[str] = None

class ScoreBatchRequest(BaseModel):
	all: bool = True
	customer_ids: Optional[List[str]] = None

class ManualDecisionRequest(BaseModel):
	decision: str  # Accepted | Review | Rejected
	note: Optional[str] = None

# Analytics
class AnalyticsOverviewResponse(BaseModel):
	total_customers: int
	avg_dsr: float
	decisions_breakdown: Dict[str, int]
	gender_distribution: Dict[str, int]
	financing_type_distribution: Dict[str, int]
	dsr_histogram: Dict[str, int]