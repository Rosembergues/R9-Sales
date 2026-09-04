import React, { useState, useEffect } from 'react';
import { WeeklyRankView } from './WeeklyRankView';
import { MonthlyRankView } from './MonthlyRankView';

export { WeeklyRankView } from './WeeklyRankView';
export { MonthlyRankView } from './MonthlyRankView';

interface LiveTeamLeaderboardProps {
  period?: 'semanal' | 'mensal';
}

export const LiveTeamLeaderboard: React.FC<LiveTeamLeaderboardProps> = ({ period: initialPeriod = 'semanal' }) => {
  const [currentPeriod, setCurrentPeriod] = useState<'semanal' | 'mensal'>(initialPeriod);

  useEffect(() => {
    setCurrentPeriod(initialPeriod);
  }, [initialPeriod]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200/80 text-xs font-semibold">
        <button
          onClick={() => setCurrentPeriod('semanal')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentPeriod === 'semanal'
              ? 'bg-white text-blue-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Ranking Semanal
        </button>
        <button
          onClick={() => setCurrentPeriod('mensal')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentPeriod === 'mensal'
              ? 'bg-white text-purple-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Ranking Mensal
        </button>
      </div>

      {currentPeriod === 'mensal' ? <MonthlyRankView /> : <WeeklyRankView />}
    </div>
  );
};
