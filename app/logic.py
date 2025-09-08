import logging
from pathlib import Path
from app.database import engine

app_logger = logging.getLogger("uvicorn")
app_logger.info(f"Using database: {Path(engine.url.database)}")

# Allowed installment periods by asset type
installment_options = {
	"Car": [36, 48, 60, 72, 84],          # 3–7 years
	"House": [120, 180, 240, 300],        # 10–25 years
	"Equipment": [12, 24, 36, 48, 60],    # 1–5 years
}

def _normalize_asset_type(value):
	if value is None:
		return "Car"
	return str(value).strip().title()

def _to_int_or_none(value):
	try:
		return int(value)
	except Exception:
		return None

def _pick_installment_period(asset_type, requested_months):
	allowed = installment_options.get(asset_type, [36])
	if not requested_months:
		return allowed[0]
	requested = _to_int_or_none(requested_months)
	if not requested:
		return allowed[0]
	if requested not in allowed:
		return min(allowed, key=lambda x: abs(x - requested))
	return requested

def process_customer_row(row_like):
	row = row_like

	income = float(row["income"])
	expenses = float(row["expenses"])
	existing_loans = float(row["existing_loans"])
	asset_value = float(row["asset_value"])
	down_payment = float(row["down_payment"])

	# Normalize asset type and pick/snap installment period from input
	asset_type_norm = _normalize_asset_type(row["asset_type"])
	requested_months = row.get("installment_period") if hasattr(row, "get") else row["installment_period"]
	months = _pick_installment_period(asset_type_norm, requested_months)

	profit_rate = 0.10

	loan_amount = asset_value - down_payment
	total_cost = loan_amount * (1 + profit_rate * (months / 12))
	monthly_installment = total_cost / months
	dsr = (existing_loans + monthly_installment) / income if income > 0 else 1.0

	explanation = ""
	suggestions = []

	if dsr <= 0.45:
		decision = "Accepted"
		if existing_loans > 0:
			explanation = (
				f"Your application is accepted. Note: You have existing loans totaling "
				f"{existing_loans:.2f} which are still within acceptable limits."
			)
		else:
			explanation = "Your application is accepted. Your DSR is low and net income is sufficient."
	elif dsr <= 0.60:
		decision = "Review"
		explanation = (
			f"Your application needs manual review. Your DSR is {dsr:.4f} ({dsr*100:.2f}%), "
			f"which is above the automatic approval threshold but within review limits."
		)
		suggestions.append("Consider increasing your down payment to reduce the monthly installment.")
		if existing_loans > 0:
			suggestions.append("Pay off some existing loans to lower your total obligations.")
		if expenses > 0.5 * income:
			suggestions.append("Try to reduce your monthly expenses.")
		# Offer a longer allowed term if available
		allowed = installment_options.get(asset_type_norm, [months])
		longer_terms = [m for m in allowed if m > months]
		if longer_terms:
			suggestions.append(f"Consider extending the installment period to {longer_terms[0]} months.")
	else:
		decision = "Rejected"
		explanation = (
			f"Your application is rejected because your DSR ({dsr:.4f} or {dsr*100:.2f}%) is too high. "
			f"Total obligations after financing: {existing_loans + monthly_installment:.2f}, net income: {income:.2f}."
		)
		if existing_loans > 0:
			suggestions.append("Pay off existing loans to reduce your DSR.")
		if income < (existing_loans + monthly_installment) / 0.58:
			suggestions.append("Increase your net monthly income.")
		suggestions.append("Increase your down payment to reduce the financed amount.")
		# Offer the longest allowed term to minimize installment
		longest = max(installment_options.get(asset_type_norm, [months]))
		if longest > months:
			suggestions.append(f"Consider extending the installment period to {longest} months.")

	return {
		"customer_id": row["customer_id"],
		"name": row["name"],
		"gender": row["gender"],
		"age": row["age"],
		"job_type": row["job_type"],
		"income": income,
		"expenses": expenses,
		"credit_history": str(row["credit_history"]),
		"existing_loans": existing_loans,
		"financing_type": row["financing_type"],
		"asset_type": asset_type_norm,
		"asset_value": asset_value,
		"down_payment": down_payment,
		"installment_period": months,
		"monthly_installment": monthly_installment,
		"total_cost": total_cost,
		"dsr": dsr,
		"decision": decision,
		"explanation": explanation,
		"suggestions": "\n".join(suggestions),
	}