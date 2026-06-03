import { useState, useEffect } from 'react';
import './index.css';
import rawData from './data.json';
import { calculateGroupStandings, getKnockoutMatches } from './utils';

// Helper component to render each match row cleanly
const MatchRow = ({ m, isKnockout, predictions, adminPreds, currentUser, handleScoreChange, handleLock }) => {
  const p = predictions[m.id] || {};
  const a = adminPreds[m.id] || {};
  
  const isAdmin = currentUser === 'admin';
  const isAdminSet = a.s1 !== undefined && a.s1 !== '' && a.s2 !== undefined && a.s2 !== '';
  const isUserLocked = p.locked;
  const isUnknown = m.t1 === '؟' || m.t2 === '؟';
  
  // Inputs are disabled if it's unknown, OR if user locked it, OR if admin already set the real result
  const disabled = isUnknown || (!isAdmin && (isUserLocked || isAdminSet));

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
          {!isAdmin && !disabled && p.s1 !== undefined && p.s1 !== '' && p.s2 !== undefined && p.s2 !== '' && (
            <button className="lock-btn" onClick={() => handleLock(m.id)}>ثبت</button>
          )}
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
  const [users, setUsers] = useState([]); // [{ username, password }]
  const [currentUser, setCurrentUser] = useState(null);
  const [predictions, setPredictions] = useState({});
  const [activeTab, setActiveTab] = useState('groups');

  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  useEffect(() => {
    // Clear old predictions and reset to V2 mapping
    if (localStorage.getItem('wc2026_version') !== 'v2') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('wc2026_')) localStorage.removeItem(key);
      });
      localStorage.setItem('wc2026_version', 'v2');
      window.location.reload();
    }

    let savedUsers = JSON.parse(localStorage.getItem('wc2026_auth_users') || '[]');
    if (!savedUsers.find(u => u.username === 'admin')) {
      savedUsers.push({ username: 'admin', password: 'admin' });
      localStorage.setItem('wc2026_auth_users', JSON.stringify(savedUsers));
    }
    setUsers(savedUsers);
  }, []);

  const handleAuth = () => {
    if (!authUsername || !authPassword) return alert('نام کاربری و رمز عبور الزامی است.');
    
    const existing = users.find(u => u.username === authUsername);
    if (existing) {
      if (existing.password === authPassword) {
        setCurrentUser(existing.username);
        const savedPreds = JSON.parse(localStorage.getItem(`wc2026_preds_${existing.username}`) || '{}');
        setPredictions(savedPreds);
        setAuthUsername('');
        setAuthPassword('');
      } else {
        alert('رمز عبور اشتباه است!');
      }
    } else {
      if (authUsername.toLowerCase() === 'admin') return alert('این نام کاربری رزرو شده است.');
      
      const newUsers = [...users, { username: authUsername, password: authPassword }];
      setUsers(newUsers);
      localStorage.setItem('wc2026_auth_users', JSON.stringify(newUsers));
      
      setCurrentUser(authUsername);
      setPredictions({});
      setAuthUsername('');
      setAuthPassword('');
      alert('حساب کاربری جدید ساخته شد و وارد شدید.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPredictions({});
    setActiveTab('groups');
  };

  const handleScoreChange = (matchId, team, value) => {
    if (!currentUser) return;
    if (value !== '' && (isNaN(value) || value < 0)) return;
    
    const newPreds = { ...predictions };
    if (!newPreds[matchId]) newPreds[matchId] = { s1: '', s2: '', p1: '', p2: '', locked: false };
    
    if (team === 1) newPreds[matchId].s1 = value;
    else if (team === 2) newPreds[matchId].s2 = value;
    else if (team === 'p1') newPreds[matchId].p1 = value;
    else if (team === 'p2') newPreds[matchId].p2 = value;

    setPredictions(newPreds);
    localStorage.setItem(`wc2026_preds_${currentUser}`, JSON.stringify(newPreds));
  };

  const handleLockPrediction = (matchId) => {
    const newPreds = { ...predictions };
    if (newPreds[matchId]) {
      newPreds[matchId].locked = true;
      setPredictions(newPreds);
      localStorage.setItem(`wc2026_preds_${currentUser}`, JSON.stringify(newPreds));
    }
  };

  const adminPreds = currentUser === 'admin' 
    ? predictions 
    : JSON.parse(localStorage.getItem('wc2026_preds_admin') || '{}');

  const knockouts = getKnockoutMatches(rawData, adminPreds);
  const isAdmin = currentUser === 'admin';

  const renderLeaderboard = () => {
    const userScores = users.filter(u => u.username !== 'admin').map(u => {
      const userPreds = JSON.parse(localStorage.getItem(`wc2026_preds_${u.username}`) || '{}');
      let points = 0;
      let exactMatches = 0;
      let correctOutcomes = 0;

      Object.keys(adminPreds).forEach(mId => {
        const a = adminPreds[mId];
        const p = userPreds[mId];
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
      return { username: u.username, points, exactMatches, correctOutcomes };
    });

    userScores.sort((a, b) => b.points - a.points);

    return (
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 className="stage-title gold" style={{ textAlign: 'center' }}>جدول امتیازات کاربران</h2>
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
              <tr><td colSpan="5">هنوز کاربری ثبت نشده است.</td></tr>
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
          <h1 className="logo">پیش‌بینی جام جهانی ۲۰۲۶</h1>
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
            <span>کاربر فعال: <strong style={{ color: isAdmin ? 'var(--gold)' : 'var(--text-main)' }}>
              {isAdmin ? '👑 ادمین (ثبت نتایج واقعی)' : currentUser}
            </strong></span>
            <button className="logout-btn" onClick={handleLogout}>خروج</button>
          </div>
        )}
      </header>

      {!currentUser ? (
        <div className="welcome-screen">
          <h2>به سامانه پیش‌بینی جام جهانی خوش آمدید</h2>
          <p>اگر حساب دارید وارد شوید، در غیر اینصورت به صورت خودکار ثبت‌نام می‌شوید.</p>
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
                          predictions={predictions} adminPreds={adminPreds} 
                          currentUser={currentUser} handleScoreChange={handleScoreChange} handleLock={handleLockPrediction}
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
                  {knockouts.r32.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={predictions} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} handleLock={handleLockPrediction} />)}
                </div>
              </div>
              <div className="knockout-stage">
                <h2 className="stage-title">یک هشتم نهایی (R16)</h2>
                <div className="match-list">
                  {knockouts.r16.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={predictions} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} handleLock={handleLockPrediction} />)}
                </div>
              </div>
              <div className="knockout-stage">
                <h2 className="stage-title">یک چهارم نهایی</h2>
                <div className="match-list">
                  {knockouts.qf.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={predictions} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} handleLock={handleLockPrediction} />)}
                </div>
              </div>
              <div className="knockout-stage">
                <h2 className="stage-title">نیمه‌نهایی</h2>
                <div className="match-list">
                  {knockouts.sf.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={predictions} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} handleLock={handleLockPrediction} />)}
                </div>
              </div>
              <div className="knockout-stage final-stage">
                <h2 className="stage-title">رده‌بندی</h2>
                <div className="match-list">
                  {knockouts.third.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={predictions} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} handleLock={handleLockPrediction} />)}
                </div>
                <h2 className="stage-title gold">فینال</h2>
                <div className="match-list">
                  {knockouts.final.map(m => <MatchRow key={m.id} m={m} isKnockout={true} predictions={predictions} adminPreds={adminPreds} currentUser={currentUser} handleScoreChange={handleScoreChange} handleLock={handleLockPrediction} />)}
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
