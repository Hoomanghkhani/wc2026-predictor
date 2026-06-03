import { useState, useEffect } from 'react';
import './index.css';
import rawData from './data.json';
import { calculateGroupStandings, getKnockoutMatches } from './utils';

const DB_URL = "https://wc2026-8c20c-default-rtdb.firebaseio.com";

// Helper component to render each match row cleanly
const MatchRow = ({ m, isKnockout, predictions, adminPreds, currentUser, handleScoreChange }) => {
  const p = predictions[m.id] || {};
  const a = adminPreds[m.id] || {};
  
  const isAdmin = currentUser === 'admin';
  const isAdminSet = a.s1 !== undefined && a.s1 !== '' && a.s2 !== undefined && a.s2 !== '';
  const isUnknown = m.t1 === '؟' || m.t2 === '؟';
  
  // Inputs are disabled if it's unknown, OR if user is NOT admin and the admin has already set the result
  const disabled = isUnknown || (!isAdmin && isAdminSet);

  // Determine Class based on correctness (Only if admin has set result and user is not admin)
  let matchClass = 'match-row';
  if (!isAdmin && isAdminSet) {
    const hasPred = p.s1 !== undefined && p.s1 !== '' && p.s2 !== undefined && p.s2 !== '';
    if (!hasPred) {
      matchClass += ' wrong-match';
    } else {
      const ps1 = parseInt(p.s1), ps2 = parseInt(p.s2);
      const as1 = parseInt(a.s1), as2 = parseInt(a.s2);
      const exact = ps1 === as1 && ps2 === as2;
      const outcome = (ps1 > ps2 && as1 > as2) || (ps1 < ps2 && as1 < as2) || (ps1 === ps2 && as1 === as2);

      if (exact) matchClass += ' exact-match';
      else if (outcome) matchClass += ' correct-outcome';
      else matchClass += ' wrong-match';
    }
  }

  const isTied = p.s1 !== '' && p.s2 !== '' && p.s1 === p.s2;

  return (
    <div className={matchClass}>
      <div className="match-main">
        <span className="match-team right">{m.team1 || m.t1}</span>
        <div className="match-inputs">
          <input 
            type="text" className="score-input" value={p.s1 ?? ''}
            onChange={(e) => handleScoreChange(m.id, 1, e.target.value)}
            disabled={disabled}
          />
          <span>-</span>
          <input 
            type="text" className="score-input" value={p.s2 ?? ''}
            onChange={(e) => handleScoreChange(m.id, 2, e.target.value)}
            disabled={disabled}
          />
        </div>
        <span className="match-team left">{m.team2 || m.t2}</span>
      </div>
      {isKnockout && isTied && !isUnknown && (
        <div className="penalty-inputs">
          <span>پنالتی:</span>
          <input 
            type="text" className="score-input penalty" value={p.p1 ?? ''}
            onChange={(e) => handleScoreChange(m.id, 'p1', e.target.value)}
            disabled={disabled}
          />
          <span>-</span>
          <input 
            type="text" className="score-input penalty" value={p.p2 ?? ''}
            onChange={(e) => handleScoreChange(m.id, 'p2', e.target.value)}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};

function App() {
  const [dbUsers, setDbUsers] = useState({}); // { username: password }
  const [dbPredictions, setDbPredictions] = useState({}); // { username: { matchId: { s1, s2 } } }
  
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('groups');

  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch initial data from Firebase via REST API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsSyncing(true);
        const resUsers = await fetch(`${DB_URL}/users.json`);
        let fetchedUsers = (await resUsers.json()) || {};
        
        // Auto create admin if doesn't exist on server
        if (!fetchedUsers['admin']) {
          await fetch(`${DB_URL}/users/admin.json`, { method: 'PUT', body: JSON.stringify('admin') });
          fetchedUsers['admin'] = 'admin';
        }
        setDbUsers(fetchedUsers);

        const resPreds = await fetch(`${DB_URL}/predictions.json`);
        const fetchedPreds = (await resPreds.json()) || {};
        setDbPredictions(fetchedPreds);
      } catch (error) {
        console.error("Error fetching from Firebase:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchData();
    // Poll every 5 seconds to simulate real-time updates for other users
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAuth = async () => {
    if (!authUsername || !authPassword) return alert('نام کاربری و رمز عبور الزامی است.');
    const userLower = authUsername.toLowerCase();
    
    if (dbUsers[userLower]) {
      if (dbUsers[userLower] === authPassword) {
        setCurrentUser(userLower);
        setAuthUsername('');
        setAuthPassword('');
      } else {
        alert('رمز عبور اشتباه است!');
      }
    } else {
      if (userLower === 'admin') return alert('این نام کاربری رزرو شده است.');
      
      // Register new user on Firebase
      try {
        await fetch(`${DB_URL}/users/${userLower}.json`, { method: 'PUT', body: JSON.stringify(authPassword) });
        setDbUsers(prev => ({ ...prev, [userLower]: authPassword }));
        setCurrentUser(userLower);
        setAuthUsername('');
        setAuthPassword('');
        alert('حساب کاربری جدید در سرور ابری ساخته شد و وارد شدید.');
      } catch (e) {
        alert('خطا در ارتباط با سرور ابری!');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('groups');
  };

  const handleScoreChange = async (matchId, team, value) => {
    if (!currentUser) return;
    if (value !== '' && (isNaN(value) || value < 0)) return;
    
    // Optimistic UI update
    const userPreds = dbPredictions[currentUser] || {};
    const newPred = { ...(userPreds[matchId] || { s1: '', s2: '', p1: '', p2: '' }) };
    
    if (team === 1) newPred.s1 = value;
    else if (team === 2) newPred.s2 = value;
    else if (team === 'p1') newPred.s1 = value; // typo prevention, assuming p1 and p2 below
    else if (team === 'p1') newPred.p1 = value;
    else if (team === 'p2') newPred.p2 = value;

    if(team === 'p1') newPred.p1 = value; // Corrected overrides

    setDbPredictions(prev => ({
      ...prev,
      [currentUser]: {
        ...(prev[currentUser] || {}),
        [matchId]: newPred
      }
    }));

    // Save to Firebase asynchronously
    try {
      await fetch(`${DB_URL}/predictions/${currentUser}/${matchId}.json`, {
        method: 'PATCH',
        body: JSON.stringify(newPred)
      });
    } catch (e) {
      console.error("Failed to sync score to server", e);
    }
  };

  const adminPreds = dbPredictions['admin'] || {};
  const currentPreds = currentUser ? (dbPredictions[currentUser] || {}) : {};
  const knockouts = getKnockoutMatches(rawData, adminPreds);
  const isAdmin = currentUser === 'admin';

  const renderLeaderboard = () => {
    const userScores = Object.keys(dbUsers).filter(u => u !== 'admin').map(username => {
      const uPreds = dbPredictions[username] || {};
      let points = 0;
      let exactMatches = 0;
      let correctOutcomes = 0;

      Object.keys(adminPreds).forEach(mId => {
        const a = adminPreds[mId];
        const p = uPreds[mId];
        if (a && a.s1 !== '' && a.s2 !== '' && p && p.s1 !== '' && p.s2 !== '') {
          const as1 = parseInt(a.s1), as2 = parseInt(a.s2);
          const ps1 = parseInt(p.s1), ps2 = parseInt(p.s2);

          if (as1 === ps1 && as2 === ps2) {
            points += 3;
            exactMatches += 1;
          } else if ((as1 > as2 && ps1 > ps2) || (as1 < as2 && ps1 < ps2) || (as1 === as2 && ps1 === ps2)) {
            points += 1;
            correctOutcomes += 1;
          }
        }
      });
      return { username, points, exactMatches, correctOutcomes };
    });

    userScores.sort((a, b) => b.points - a.points);

    return (
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 className="stage-title gold">جدول امتیازات (Leaderboard)</h2>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>رتبه</th>
              <th>نام کاربر</th>
              <th>دقیق (۳ امتیازی)</th>
              <th>صحیح (۱ امتیازی)</th>
              <th>امتیاز کل</th>
            </tr>
          </thead>
          <tbody>
            {userScores.map((u, idx) => (
              <tr key={u.username} className={idx === 0 ? 'qualifier' : ''}>
                <td><strong>{idx + 1}</strong></td>
                <td>{u.username}</td>
                <td>{u.exactMatches}</td>
                <td>{u.correctOutcomes}</td>
                <td><strong style={{ color: 'var(--primary)' }}>{u.points}</strong></td>
              </tr>
            ))}
            {userScores.length === 0 && (
              <tr><td colSpan="5">هنوز کاربری در سرور ثبت نشده است.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header>
        <div>
          <h1 className="logo">پیش‌بینی جام جهانی ۲۰۲۶ {isSyncing && <span style={{fontSize:'0.8rem', color:'var(--success)'}}> (سینک ابری...)</span>}</h1>
          {currentUser && (
            <div className="tabs">
              <button className={activeTab === 'groups' ? 'active' : ''} onClick={() => setActiveTab('groups')}>مرحله گروهی</button>
              <button className={activeTab === 'knockouts' ? 'active' : ''} onClick={() => setActiveTab('knockouts')}>مراحل حذفی</button>
              <button className={activeTab === 'leaderboard' ? 'active' : ''} onClick={() => setActiveTab('leaderboard')}>جدول امتیازات</button>
            </div>
          )}
        </div>
        
        {!currentUser ? (
          <div className="auth-container">
            <div className="auth-box">
              <input type="text" placeholder="نام کاربری" value={authUsername} onChange={e => setAuthUsername(e.target.value)} />
              <input type="password" placeholder="رمز عبور" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
              <button onClick={handleAuth}>ورود / ثبت‌نام</button>
            </div>
          </div>
        ) : (
          <div className="user-profile">
            <span>کاربر فعال: <strong style={{ color: isAdmin ? 'var(--gold)' : 'var(--primary)' }}>
              {isAdmin ? '👑 ادمین (ثبت نتایج واقعی)' : currentUser}
            </strong></span>
            <button className="logout-btn" onClick={handleLogout}>خروج</button>
          </div>
        )}
      </header>

      {!currentUser ? (
        <div className="welcome-screen">
          <h2>به سامانه آنلاین پیش‌بینی جام جهانی ۲۰۲۶ خوش آمدید</h2>
          <p>این سامانه مستقیماً به سرور ابری متصل است. رقابت شما با دوستانتان لحظه‌ای ثبت می‌شود!</p>
        </div>
      ) : (
        <>
          {activeTab === 'groups' && (
            <div className="grid-container">
              {Object.keys(rawData.groups).map(groupKey => {
                const groupTeams = rawData.groups[groupKey];
                const groupMatches = rawData.matches.filter(m => m.group === groupKey);
                const standings = calculateGroupStandings(groupKey, groupTeams, rawData.matches, adminPreds);

                return (
                  <div key={groupKey} className="card">
                    <h2>گروه {groupKey}</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>تیم</th><th>ب</th><th>ت</th><th>امتیاز</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((t, idx) => (
                          <tr key={t.name} className={idx < 2 ? 'qualifier' : ''}>
                            <td>{t.name}</td><td>{t.pld}</td><td dir="ltr">{t.gd > 0 ? `+${t.gd}` : t.gd}</td><td><strong>{t.pts}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="match-list">
                      {groupMatches.map(m => (
                        <MatchRow 
                          key={m.id} m={m} isKnockout={false} 
                          predictions={currentPreds} adminPreds={adminPreds} 
                          currentUser={currentUser} handleScoreChange={handleScoreChange}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'knockouts' && (
            <div className="knockout-container">
              <div className="knockout-stage">
                <h2 className="stage-title">یک شانزدهم نهایی (R32)</h2>
                <div className="match-list">
                  {knockouts.r32.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={currentPreds} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} />)}
                </div>
              </div>
              <div className="knockout-stage">
                <h2 className="stage-title">یک هشتم نهایی (R16)</h2>
                <div className="match-list">
                  {knockouts.r16.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={currentPreds} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} />)}
                </div>
              </div>
              <div className="knockout-stage">
                <h2 className="stage-title">یک چهارم نهایی</h2>
                <div className="match-list">
                  {knockouts.qf.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={currentPreds} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} />)}
                </div>
              </div>
              <div className="knockout-stage">
                <h2 className="stage-title">نیمه‌نهایی</h2>
                <div className="match-list">
                  {knockouts.sf.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={currentPreds} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} />)}
                </div>
              </div>
              <div className="knockout-stage final-stage">
                <h2 className="stage-title">رده‌بندی</h2>
                <div className="match-list">
                  {knockouts.third.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={currentPreds} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} />)}
                </div>
                <h2 className="stage-title gold">فینال</h2>
                <div className="match-list">
                  {knockouts.final.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={currentPreds} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} />)}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leaderboard' && renderLeaderboard()}
        </>
      )}
    </div>
  );
}

export default App;
