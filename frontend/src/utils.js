export const calculateGroupStandings = (groupName, teams, matches, userPredictions) => {
  const standings = teams.map(team => ({
    name: team, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0
  }));

  const getTeam = name => standings.find(t => t.name === name);

  matches.forEach(m => {
    if (m.group === groupName) {
      const pred = userPredictions[m.id];
      if (pred && pred.s1 !== '' && pred.s2 !== '') {
        const s1 = parseInt(pred.s1);
        const s2 = parseInt(pred.s2);
        const t1 = getTeam(m.team1);
        const t2 = getTeam(m.team2);

        if (t1 && t2) {
          t1.pld++; t2.pld++;
          t1.gf += s1; t1.ga += s2; t1.gd = t1.gf - t1.ga;
          t2.gf += s2; t2.ga += s1; t2.gd = t2.gf - t2.ga;

          if (s1 > s2) { t1.w++; t2.l++; t1.pts += 3; }
          else if (s1 < s2) { t2.w++; t1.l++; t2.pts += 3; }
          else { t1.d++; t2.d++; t1.pts++; t2.pts++; }
        }
      }
    }
  });

  standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  return standings;
};

export const getKnockoutMatches = (rawData, predictions) => {
  const allGroups = {};
  const groupPlayedCount = {};
  let totalPlayedGroupMatches = 0;

  // Calculate how many matches are played in each group
  rawData.matches.forEach(m => {
    if (m.group && m.group !== 'W' && m.group !== '1' && m.group !== '2') {
      const p = predictions[m.id];
      if (p && p.s1 !== '' && p.s2 !== '') {
        groupPlayedCount[m.group] = (groupPlayedCount[m.group] || 0) + 1;
        totalPlayedGroupMatches++;
      }
    }
  });

  Object.keys(rawData.groups).forEach(g => {
    allGroups[g] = calculateGroupStandings(g, rawData.groups[g], rawData.matches, predictions);
  });

  const firsts = {};
  const seconds = {};
  const thirds = [];

  Object.keys(allGroups).forEach(g => {
    const std = allGroups[g];
    // Check if group is fully played (6 matches per group)
    const isGroupFinished = (groupPlayedCount[g] === 6);

    firsts[g] = isGroupFinished ? std[0]?.name : '؟';
    seconds[g] = isGroupFinished ? std[1]?.name : '؟';
    
    if (isGroupFinished && std[2]) {
      thirds.push({ group: g, team: std[2].name, pts: std[2].pts, gd: std[2].gd, gf: std[2].gf });
    }
  });

  thirds.sort((a,b) => {
    if(b.pts !== a.pts) return b.pts - a.pts;
    if(b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  // Need all 72 group matches to be finished to fairly determine best 3rd placed teams
  const allGroupsFinished = (totalPlayedGroupMatches === 72);
  const bestThirds = thirds.slice(0, 8).map(t => t.team);
  
  const getT3 = (idx) => allGroupsFinished ? (bestThirds[idx] || '؟') : '؟';

  const r32 = [
    { id: 73, stage: 'R32', t1: firsts['A'], t2: getT3(0) },
    { id: 74, stage: 'R32', t1: seconds['E'], t2: seconds['F'] },
    { id: 75, stage: 'R32', t1: firsts['C'], t2: getT3(2) },
    { id: 76, stage: 'R32', t1: firsts['J'], t2: seconds['B'] },
    { id: 77, stage: 'R32', t1: firsts['E'], t2: getT3(4) },
    { id: 78, stage: 'R32', t1: firsts['L'], t2: seconds['D'] },
    { id: 79, stage: 'R32', t1: firsts['G'], t2: getT3(6) },
    { id: 80, stage: 'R32', t1: seconds['I'], t2: seconds['J'] },
    { id: 81, stage: 'R32', t1: firsts['B'], t2: getT3(1) },
    { id: 82, stage: 'R32', t1: seconds['G'], t2: seconds['H'] },
    { id: 83, stage: 'R32', t1: firsts['D'], t2: getT3(3) },
    { id: 84, stage: 'R32', t1: firsts['K'], t2: seconds['C'] },
    { id: 85, stage: 'R32', t1: firsts['F'], t2: getT3(5) },
    { id: 86, stage: 'R32', t1: firsts['I'], t2: seconds['A'] },
    { id: 87, stage: 'R32', t1: firsts['H'], t2: getT3(7) },
    { id: 88, stage: 'R32', t1: seconds['K'], t2: seconds['L'] },
  ];

  const getWinner = (matchList, mId) => {
    const match = matchList.find(m => m.id === mId);
    if (!match || match.t1 === '؟' || match.t2 === '؟') return '؟';
    const p = predictions[mId];
    if (!p || p.s1 === '' || p.s2 === '') return '؟';
    const s1 = parseInt(p.s1);
    const s2 = parseInt(p.s2);
    if (s1 > s2) return match.t1;
    if (s2 > s1) return match.t2;
    if (p.p1 !== undefined && p.p2 !== undefined && p.p1 !== '' && p.p2 !== '') {
        return parseInt(p.p1) > parseInt(p.p2) ? match.t1 : match.t2;
    }
    return '؟';
  };

  const getLoser = (matchList, mId) => {
    const match = matchList.find(m => m.id === mId);
    if (!match || match.t1 === '؟' || match.t2 === '؟') return '؟';
    const p = predictions[mId];
    if (!p || p.s1 === '' || p.s2 === '') return '؟';
    const s1 = parseInt(p.s1);
    const s2 = parseInt(p.s2);
    if (s1 > s2) return match.t2;
    if (s2 > s1) return match.t1;
    if (p.p1 !== undefined && p.p2 !== undefined && p.p1 !== '' && p.p2 !== '') {
        return parseInt(p.p1) > parseInt(p.p2) ? match.t2 : match.t1;
    }
    return '؟';
  };

  const r16 = [
    { id: 89, stage: 'R16', t1: getWinner(r32, 73), t2: getWinner(r32, 74) },
    { id: 90, stage: 'R16', t1: getWinner(r32, 75), t2: getWinner(r32, 76) },
    { id: 91, stage: 'R16', t1: getWinner(r32, 77), t2: getWinner(r32, 78) },
    { id: 92, stage: 'R16', t1: getWinner(r32, 79), t2: getWinner(r32, 80) },
    { id: 93, stage: 'R16', t1: getWinner(r32, 81), t2: getWinner(r32, 82) },
    { id: 94, stage: 'R16', t1: getWinner(r32, 83), t2: getWinner(r32, 84) },
    { id: 95, stage: 'R16', t1: getWinner(r32, 85), t2: getWinner(r32, 86) },
    { id: 96, stage: 'R16', t1: getWinner(r32, 87), t2: getWinner(r32, 88) },
  ];

  const qf = [
    { id: 97, stage: 'QF', t1: getWinner(r16, 89), t2: getWinner(r16, 90) },
    { id: 98, stage: 'QF', t1: getWinner(r16, 91), t2: getWinner(r16, 92) },
    { id: 99, stage: 'QF', t1: getWinner(r16, 93), t2: getWinner(r16, 94) },
    { id: 100, stage: 'QF', t1: getWinner(r16, 95), t2: getWinner(r16, 96) },
  ];

  const sf = [
    { id: 101, stage: 'SF', t1: getWinner(qf, 97), t2: getWinner(qf, 98) },
    { id: 102, stage: 'SF', t1: getWinner(qf, 99), t2: getWinner(qf, 100) },
  ];

  const third = [
    { id: 103, stage: '3RD', t1: getLoser(sf, 101), t2: getLoser(sf, 102) }
  ];

  const final = [
    { id: 104, stage: 'FINAL', t1: getWinner(sf, 101), t2: getWinner(sf, 102) }
  ];

  return { r32, r16, qf, sf, third, final };
};

export const teamNamesMapping = {
  "Mexico": "مکزیک", "South Africa": "آفریقای جنوبی", "South Korea": "کره جنوبی", "Czech Republic": "چک",
  "Canada": "کانادا", "Bosnia and Herzegovina": "بوسنی و هرزگوین", "Qatar": "قطر", "Switzerland": "سوئیس",
  "Brazil": "برزیل", "Morocco": "مراکش", "Haiti": "هائیتی", "Scotland": "اسکاتلند",
  "USA": "آمریکا", "Paraguay": "پاراگوئه", "Australia": "استرالیا", "Turkey": "ترکیه",
  "Germany": "آلمان", "Curacao": "کوراسائو", "Ivory Coast": "ساحل عاج", "Ecuador": "اکوادور",
  "Netherlands": "هلند", "Japan": "ژاپن", "Sweden": "سوئد", "Tunisia": "تونس",
  "Belgium": "بلژیک", "Egypt": "مصر", "Iran": "ایران", "New Zealand": "نیوزیلند",
  "Spain": "اسپانیا", "Cape Verde": "کیپ ورد", "Saudi Arabia": "عربستان سعودی", "Uruguay": "اروگوئه",
  "France": "فرانسه", "Senegal": "سنگال", "Iraq": "عراق", "Norway": "نروژ",
  "Argentina": "آرژانتین", "Algeria": "الجزایر", "Austria": "اتریش", "Jordan": "اردن",
  "Portugal": "پرتغال", "Congo": "کنگو", "Uzbekistan": "ازبکستان", "Colombia": "کلمبیا",
  "England": "انگلیس", "Croatia": "کرواسی", "Ghana": "غنا", "Panama": "پاناما"
};

export const fetchLiveResultsFromAPI = async (apiKey, rawMatches) => {
  try {
    const response = await fetch("https://v3.football.api-sports.io/fixtures?league=1&season=2026", {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        "x-rapidapi-host": "v3.football.api-sports.io"
      }
    });

    if (!response.ok) {
      throw new Error('API Request Failed');
    }

    const data = await response.json();
    if (!data.response || data.response.length === 0) {
      // Return a message if tournament data is not available yet on the API
      return { error: 'هنوز داده‌های مسابقات جام جهانی ۲۰۲۶ در API قرار نگرفته است.' };
    }

    const apiFixtures = data.response;
    const adminUpdates = {};
    const getFaName = (enName) => teamNamesMapping[enName] || enName;

    rawMatches.forEach(localMatch => {
      // Find corresponding fixture in API
      const matchedApiFixture = apiFixtures.find(apiF => {
        const homeFa = getFaName(apiF.teams.home.name);
        const awayFa = getFaName(apiF.teams.away.name);
        return (
          (localMatch.team1 === homeFa && localMatch.team2 === awayFa) ||
          (localMatch.team1 === awayFa && localMatch.team2 === homeFa)
        );
      });

      if (matchedApiFixture) {
        const status = matchedApiFixture.fixture.status.short;
        if (['FT', 'AET', 'PEN'].includes(status)) {
          let s1 = matchedApiFixture.goals.home;
          let s2 = matchedApiFixture.goals.away;

          // Swap scores if the home/away order in API is reversed compared to local JSON
          if (localMatch.team1 === getFaName(matchedApiFixture.teams.away.name)) {
            s1 = matchedApiFixture.goals.away;
            s2 = matchedApiFixture.goals.home;
          }

          let p1 = '';
          let p2 = '';
          if (status === 'PEN') {
            let apiP1 = matchedApiFixture.score.penalty.home;
            let apiP2 = matchedApiFixture.score.penalty.away;
            if (localMatch.team1 === getFaName(matchedApiFixture.teams.away.name)) {
              p1 = apiP2;
              p2 = apiP1;
            } else {
              p1 = apiP1;
              p2 = apiP2;
            }
          }

          adminUpdates[localMatch.id] = {
            s1: s1.toString(),
            s2: s2.toString(),
            p1: p1 ? p1.toString() : '',
            p2: p2 ? p2.toString() : ''
          };
        }
      }
    });

    return { updates: adminUpdates, message: 'نتایج با موفقیت همگام‌سازی شد.' };
  } catch (error) {
    console.error(error);
    return { error: 'خطا در ارتباط با سرور API-Football.' };
  }
};
