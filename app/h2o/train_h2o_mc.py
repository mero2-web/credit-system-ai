from pathlib import Path
import json
import pandas as pd
import h2o
from h2o.estimators import H2OGradientBoostingEstimator

# CSV path
CSV_PATH = r"C:\Users\Marya\OneDrive - Asia Pacific University\Desktop\credit_system\murabaha_ijarah_dataset (1) .csv"

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "h2o" / "artifacts_bin"
OUT_DIR.mkdir(parents=True, exist_ok=True)
META_PATH = OUT_DIR / "metadata.json"
MODEL_PATH_TXT = OUT_DIR / "model_path.txt"

CATEGORICAL = ["gender", "job_type", "credit_history", "financing_type", "asset_type"]
NUMERIC = ["age", "income", "expenses", "existing_loans", "asset_value", "down_payment", "installment_period"]
FEATURES = CATEGORICAL + NUMERIC
TARGET = "target_bin"  # "Accepted" vs "Rejected"
PROFIT_RATE = 0.10

def derive_rule_decision(df: pd.DataFrame) -> pd.Series:
	loan_amount = df["asset_value"] - df["down_payment"]
	total_cost = loan_amount * (1 + PROFIT_RATE * (df["installment_period"] / 12.0))
	monthly_installment = total_cost / df["installment_period"]
	income = df["income"].replace(0, 1e-9)
	dsr = (df["existing_loans"] + monthly_installment) / income
	out = []
	for v in dsr:
		if v <= 0.45:
			out.append("Accepted")
		elif v <= 0.60:
			out.append("Review")
		else:
			out.append("Rejected")
	return pd.Series(out, index=df.index)

def main():
	df = pd.read_csv(CSV_PATH)

	required = {"customer_id","name","gender","age","job_type","income","expenses","credit_history",
	            "existing_loans","financing_type","asset_type","asset_value","down_payment","installment_period"}
	missing = required - set(df.columns)
	if missing:
		raise ValueError(f"CSV missing columns: {missing}")

	# Use dataset decision if present, else derive via DSR rules
	if "decision" in df.columns:
		dec = df["decision"].astype(str)
	else:
		dec = derive_rule_decision(df)

	# Binary target: map Review -> Rejected (conservative)
	df[TARGET] = dec.map({"Accepted": "Accepted", "Review": "Rejected", "Rejected": "Rejected"}).fillna("Rejected")

	df = df[FEATURES + [TARGET]].copy()

	h2o.init(max_mem_size="2G")

	hf = h2o.H2OFrame(df)
	for c in CATEGORICAL:
		hf[c] = hf[c].asfactor()
	hf[TARGET] = hf[TARGET].asfactor()

	train, test, valid = hf.split_frame(ratios=[0.5, 0.3], seed=42)

	model = H2OGradientBoostingEstimator(
		distribution="bernoulli",
		ntrees=250,
		max_depth=5,
		learn_rate=0.05,
		seed=42
	)
	model.train(x=FEATURES, y=TARGET, training_frame=train, validation_frame=valid)

	print("\n=== Validation Metrics ===")
	print(model.model_performance(valid=True))
	print("\n=== Test Metrics ===")
	print(model.model_performance(test_data=test))

	model_path = h2o.save_model(model=model, path=str(OUT_DIR), force=True)
	MODEL_PATH_TXT.write_text(model_path, encoding="utf-8")
	META_PATH.write_text(json.dumps({
		"features": FEATURES,
		"categorical": CATEGORICAL,
		"numeric": NUMERIC,
		"target": TARGET,
		"positive_label": "Accepted",
		"profit_rate": PROFIT_RATE
	}, indent=2), encoding="utf-8")
	print(f"Saved model: {model_path}")
	print(f"Saved metadata: {META_PATH}")

if __name__ == "__main__":
	main()