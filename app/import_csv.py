import pandas as pd
from app.database import SessionLocal
from app.models import Customer
from app.logic import process_customer_row

# Updated CSV path
csv_path = r"C:\Users\Marya\OneDrive - Asia Pacific University\Desktop\credit_system\murabaha_ijarah_dataset (1) .csv"

def main():
    df = pd.read_csv(csv_path)
    db = SessionLocal()
    try:
        for _, row in df.iterrows():
            processed = process_customer_row(row)
            customer = Customer(**processed)
            db.add(customer)
        db.commit()
        print("CSV import finished.")
    finally:
        db.close()

if __name__ == "__main__":
    main()