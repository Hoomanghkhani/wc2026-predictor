import json
import re

def process_data():
    with open('wc_data.json', 'r', encoding='utf-8') as f:
        raw = json.load(f)
        
    groups = {}
    current_group = None
    
    # Process Groups
    for row in raw.get('Groups', []):
        group_letter = row.get('Unnamed: 3', '').strip()
        if len(group_letter) == 1 and group_letter.isalpha() and row.get('Unnamed: 1', '') == '':
            current_group = group_letter
            groups[current_group] = []
            continue
            
        team_code = row.get('Unnamed: 1', '').strip()
        team_name = row.get('Unnamed: 3', '').strip()
        
        if current_group and team_code.startswith(current_group) and team_name and len(team_code) == 2:
            groups[current_group].append(team_name)

    matches = []
    # Process Matches
    for row in raw.get('Matches', []):
        m_id = row.get('بازی‌ها\xa0(یا\xa0مسابقات)', '').strip()
        if m_id.isdigit():
            team1 = row.get('Unnamed: 8', '').strip()
            team2 = row.get('Unnamed: 9', '').strip()
            date = row.get('Unnamed: 5', '').strip()
            venue = row.get('Unnamed: 7', '').strip()
            group_code = row.get('Unnamed: 2', '').strip()[0] if row.get('Unnamed: 2', '') else ''
            
            matches.append({
                'id': int(m_id),
                'group': group_code,
                'team1': team1,
                'team2': team2,
                'date': date,
                'venue': venue
            })
            
    clean_data = {
        'groups': groups,
        'matches': matches
    }
    
    with open('app_data.json', 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, ensure_ascii=False, indent=2)
        
if __name__ == '__main__':
    process_data()
