import { createContext, useContext, useEffect, useState } from 'react';

const TeamContext = createContext({ teamId: '', teamName: '' });

export function TeamProvider({ children }) {
  const [team, setTeam] = useState({ teamId: '', teamName: '' });

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setTeam)
      .catch(console.error);
  }, []);

  return <TeamContext.Provider value={team}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  return useContext(TeamContext);
}
