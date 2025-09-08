from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from .database import Base

class Customer(Base):
	__tablename__ = "customers"

	id = Column(Integer, primary_key=True, index=True)
	customer_id = Column(String, unique=True, index=True, nullable=False)
	name = Column(String, nullable=False)
	gender = Column(String, nullable=False)
	age = Column(Integer, nullable=False)
	job_type = Column(String, nullable=False)
	income = Column(Float, nullable=False)
	expenses = Column(Float, nullable=False)
	credit_history = Column(String, nullable=False)
	existing_loans = Column(Float, nullable=False)
	financing_type = Column(String, nullable=False)
	asset_type = Column(String, nullable=False)
	asset_value = Column(Float, nullable=False)
	down_payment = Column(Float, nullable=False)
	installment_period = Column(Integer, nullable=False)

	# Computed/rule fields
	monthly_installment = Column(Float)
	total_cost = Column(Float)
	dsr = Column(Float)
	decision = Column(String)
	explanation = Column(String)
	suggestions = Column(String)

	# ML scoring fields (H2O)
	ml_p_accept = Column(Float)
	ml_label = Column(String)
	ml_confidence = Column(Float)
	ml_confidence_band = Column(String)
	ml_final_decision = Column(String)
	ml_updated_at = Column(DateTime(timezone=True))

	# Manual override
	manual_decision = Column(String, nullable=True)
	manual_note = Column(String, nullable=True)

	created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
	__tablename__ = "users"

	id = Column(Integer, primary_key=True, index=True)
	username = Column(String, unique=True, index=True, nullable=False)
	hashed_password = Column(String, nullable=False)
	is_active = Column(Boolean, nullable=False, server_default="1")
	created_at = Column(DateTime(timezone=True), server_default=func.now())