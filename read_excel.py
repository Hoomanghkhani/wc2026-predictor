import pandas as pd
import sys

def main():
    file_path = 'OfficebazWorldCup2026.xlsx'
    out_path = 'excel_dump.txt'
    try:
        xl = pd.ExcelFile(file_path)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(f"Sheets: {xl.sheet_names}\n")
            for sheet in xl.sheet_names:
                f.write(f"\n================ Sheet: {sheet} ================\n")
                df = xl.parse(sheet)
                f.write(df.head(50).to_string() + "\n")
        print("Done! Wrote to excel_dump.txt")
    except Exception as e:
        print("Error reading excel:", e)

if __name__ == '__main__':
    main()
