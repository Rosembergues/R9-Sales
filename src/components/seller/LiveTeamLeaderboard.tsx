import React, { useState, useEffect } from 'react';
import { RankView, type RankPeriod } from './RankView';

interface LiveTeamLeaderboardProps {
  period?: RankPeriod;
}

export const LiveTeamLeaderboard: React.FC<LiveTeamLeaderboardProps> = ({ period: initialPeriod = 'semanal' }) => {
  const [currentPeriod, setCurrentPeriod] = useState<RankPeriod>(initialPeriod);

  useEffect(() => {
    setCurrentPeriod(initialPeriod);
  }, [initialPeriod]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200/80 text-xs font-semibold">
        {([['semanal', 'Ranking Semanal'], ['mensal', 'Ranking Mensal']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setCurrentPeriod(value)}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              currentPeriod === value ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <RankView period={currentPeriod} />
    </div>
  );
};
