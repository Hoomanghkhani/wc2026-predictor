import pandas as pd
import json

def extract_groups():
    file_path = 'OfficebazWorldCup2026.xlsx'
    xl = pd.ExcelFile(file_path)
    
    data = {}
    
    if 'Groups' in xl.sheet_names:
        groups_df = xl.parse('Groups')
        data['Groups'] = groups_df.fillna('').astype(str).to_dict(orient='records')
        
    if 'Matches' in xl.sheet_names:
        matches_df = xl.parse('Matches')
        data['Matches'] = matches_df.fillna('').astype(str).to_dict(orient='records')
        
    with open('wc_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    extract_groups()
